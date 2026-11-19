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

A ledger holds everything the chat's processes made, and most of that is not
for deleting. Measured on real ledgers (2026-11-19), 96 of 181 existing entries
were folders, git's objects or the CLI's own files, the chat's transcript among
them. So the list is only regular files that still exist, and never:

- anything inside `.git`, or a worktree's `.git` link file;
- anything under `~/.claude`, or the CLI's temp folder apart from a chat's
  `scratchpad`;
- files git tracks. A path git could not answer about counts as tracked.

The same rule lives in `adi-tools/packages/created-files`; change the two together.
The host also re-reads the ledger before acting, so a button can only ever reach
a file that is on this chat's list at that moment.

## The two halves

- **webview** (`runtime/`) - `icon.js` the glyph, `link.js` the line to the host,
  `state.js` the live badge (a push from the host, re-applied through `__ccDom`
  after the app re-renders the header, never a poll), `rows.js` the rows, matched
  by path so an update keeps the scroll position and focus, `dialog.js` the list
  built on the shared `__ccModal` chrome. `button-call.js` is inserted beside the
  Session history button using the same header anchor as `panel-restart-button`.
- **host** (`host/`) - `ledger.js` replays one chat's ledger and applies the rule
  above, `tracked.js` asks git, `actions.js` reveals, copies and trashes through
  the editor's own APIs, so nothing is shelled out for those and neither editor
  is branched on. `live.js` answers the panel's messages, holds one directory
  watcher for the whole host while a panel listens, and pushes a fresh list when
  that chat's ledger changes. A panel receives the newest 300 files and the total;
  Copy all and Delete all work on the host, so they cover every file.

## Visibility

The icon appears only when the recorder is running **or** there is at least one
file to show; otherwise it is hidden. The badge shows the count (capped at `999+`).
When part of the chat went unwatched the dialog says the list may be incomplete.

Delete all asks once before it acts: the first press only names how many files it
will move to the Recycle Bin.

## Why it is a patch and not a mod

As of 2.1.292 the VS Code extension never asks for or shows mod drawing, so any
visible panel UI must be a webview patch. See the repo's notes on that.
