# created-files

A **header icon** in the Claude panel, beside Session history, with a **live
count badge** of the files *this chat* created that still exist, and a **dialog**
that lists them with reveal, delete and copy-all.

## Where the data comes from

The files are recorded by a separate elevated helper that ships with **Adi Tools**
(`adi-tools`, `resources/createdFiles`), which watches the Windows kernel's file
events and writes, per chat, an append-only ledger of the files that chat's
processes created - the one category nothing in the panel can otherwise see:
files made by **commands, scripts and builds**. This patch is a pure **reader**
of that ledger; it never records anything and never needs admin. If the helper
has never run (no Adi Tools, recording off), there is no ledger, and the icon
stays hidden.

Ledger location and line contract (shared with the Adi Tools tab, owned by
`adi-tools/packages/created-files`):

    %LOCALAPPDATA%\claude-code-patches\created-files\<sessionId>.jsonl
    %LOCALAPPDATA%\claude-code-patches\created-files\status.json

One JSON object per line: `op` of `new` / `rename` (the file appeared; rename's
`path` is the final name) / `delete` / `gap` (recording was off across a window,
so the list may be incomplete). A reader replays the lines, ignoring case.

## What is listed

A ledger holds everything the chat's processes touched, and much of that is not
for deleting. Measured on real ledgers (2026-11-19), 96 of 181 existing entries
were folders, git's objects or the CLI's own files, and `~/.claude.json` was
listed because the CLI saves it by renaming a temp over it. So a file is listed
only when (`host/replay.js`):

- the chat really made it: a `new` line, or a `rename` the change journal
  confirmed. A `rewrite` (an existing file saved again) adds nothing;
- it is still that file: the same NTFS id, and not older than its creation;
- it is not internal: `.git`, a bare repository, `~/.claude`, `~/.claude.json`,
  the CLI's cache and temp files (a chat's `scratchpad` is its work), Windows'
  per-user data, the Recycle Bin, side streams;
- git does not track it (case folded). When git cannot answer, nothing from
  that repository is listed.

The same rules live in `adi-tools/packages/created-files`; change the two together.
The host looks at a file afresh before acting on it, so a button can only ever
reach a file that is on this chat's list at that moment, and Delete all moves
nothing unless the list is exactly the one the user confirmed, and moves exactly
that list.

## A chat the recorder did not see

On 2026-11-20 only 41 of 278 chats had a ledger: every chat older than the
recorder had none, and its panel showed nothing. So for a chat whose transcript
began before its ledger, or that has no ledger, two more records are read
(`host/sources.js`), and where the ledger names a path its word stands:

- **Its scratchpad** (`host/scratch.js`): `%TEMP%\claude\<project>\<id>\scratchpad`
  carries the chat's id, so every file in it is the chat's, whatever made it.
  Most of what old chats left sits there: 204,000 files in 103 of them. The folder
  is walked without opening a file, links are not followed, `.git` is skipped, and
  it is walked again when the dialog opens.
- **What Claude wrote itself** (`host/transcript.js`): each Write result in the
  chat's transcript, and its subagents'. Only lines naming `structuredPatch` are
  parsed: 7 GB of transcripts read in 32 s, the largest chat (505 MB) in 1.8 s.
  An edit replaces the file whole, so the file's birth moves to each edit: a file
  is still the chat's when it was born while the chat wrote it, from 120 s before a
  Write or Edit line to 2 s after. 6,410 of 6,973 such files on disk passed; the
  rest were made again later by git or another chat, and git tracks most of them.

Commands leave no line in a transcript, so for the part of a chat that ran before
recording began on this machine (the earliest first line of any ledger) the dialog
says its list holds only these two. The Adi Tools tab reads the same records with
the same rules (`adi-tools/packages/created-files`: `sources.mjs`, `scratch.mjs`,
`transcript.mjs`, `stillTheChats.mjs`, adi-tools#60); change the two together. Over
every chat on this machine the two gave the same files for 280 of 281, the one
left being a chat that was writing files between the two reads.

## What a change costs

A chat that installs packages leaves 60,000 files and a 20 MB ledger. Reading all
of it and looking at every file on every change kept the host busy for seconds at
a time, and on Windows looking at a file opens it: 65,000 looks were 25 s of
processor time (measured in Adi Tools, 2026-11-19), on the thread every extension
of the window shares. So a chat a panel shows is followed (`follow.js`,
`files.js`): a change reads only the lines its ledger gained and looks only at the
files they name. A chat read for the first time answers with its newest files
looked at, and the rest are looked at a batch at a time behind that answer; the
dialog says it is still looking, and Copy all and Delete all wait for it. Opening
the dialog looks again at the rows it shows (a file deleted outside any chat
leaves no line). What git tracks is filtered again over every file only when a
repository's index changed, so a commit still takes committed files off. Files
are looked at through `original-fs` (`fs.js`): Electron's fs opens any `*.asar`
as an archive, keeps it open and calls it a folder.

Two things held that thread for long stretches once old chats were read too, both
measured over all 278 chats here (2026-11-20). **Starting git** is one blocking
call on Windows - it searches the PATH, then waits while the system looks at the
new process - and while or just after files were being looked at it took up to
835 ms; `git.js` starts it from a worker thread of its own. **What git tracks** in
a repository cloned into a scratchpad (100,000 files and more) was turned into keys
in one go, 400 ms; `tracked.js` now builds them more cheaply, in slices. After
both, the longest stretch while reading any chat was 110 ms (124 ms in another
run, for a chat of 40,000-50,000 files), against 866 ms before.

## The two halves

- **webview** (`runtime/`) - `icon.js` the glyph, `link.js` the line to the host,
  `state.js` the live badge (a push from the host, re-applied through `__ccDom`
  after the app re-renders the header, never a poll), `rows.js` the rows, matched
  by path so an update keeps the scroll position and focus, `dialog.js` the list
  built on the shared `__ccModal` chrome. `button-call.js` is inserted beside the
  Session history button using the same header anchor as `panel-restart-button`.
- **host** (`host/`, loaded in the order `load-order.json` gives) - `ledger.js`
  keeps one followed chat per chat a panel shows (`follow.js` reads what a ledger
  or a transcript gained, `sources.js` puts a chat's records together, `files.js`
  applies the rule above, `replay.js` the line rules), `tracked.js` asks git
  (through `git.js`, off the thread; `breathe.js` lets other work run between
  slices of a long loop), `actions.js` reveals,
  copies and trashes through the editor's own APIs, so nothing is shelled out for
  those and neither editor is branched on, and `acting.js` checks a path before
  any of them. `watch.js` is the folder watch, which survives the folder being
  removed. `live.js` answers the panel's messages, keeps that one watch for the
  whole host while a panel listens, and pushes a fresh list when that chat's
  ledger changes. A panel receives the newest 300 files and the total;
  Copy all and Delete all work on the host, so they cover every file.

## Visibility

The icon appears only when the recorder is running **or** there is at least one
file to show; otherwise it is hidden. The badge shows the count (capped at `999+`).
When part of the chat went unwatched the dialog says the list may be incomplete.

Delete all asks once before it acts: the first press only names how many files it
will move to the Recycle Bin, a second press within 0.6 s (a double click) is
ignored, and the question lapses when the list changes.

## Why it is a patch and not a mod

As of 2.1.292 the VS Code extension never asks for or shows mod drawing, so any
visible panel UI must be a webview patch. See the repo's notes on that.
