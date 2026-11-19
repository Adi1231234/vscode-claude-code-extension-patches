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
so the list may be incomplete). A reader replays the lines, then keeps only paths
that still exist on disk.

## The two halves

- **webview** (`runtime/`) - `icon.js` the glyph, `link.js` the line to the host,
  `state.js` the live badge (a push from the host, re-applied through `__ccDom`
  after the app re-renders the header, never a poll), `dialog.js` the list built
  on the shared `__ccModal` chrome. `button-call.js` is inserted beside the
  Session history button using the same header anchor as `panel-restart-button`.
- **host** (`host/`) - `ledger.js` reads and replays one chat's ledger and keeps
  only existing files; `live.js` answers the panel's messages, holds one
  directory watcher for the whole host fanned out to the panels that asked about
  each session id, and pushes a fresh list whenever that chat's ledger changes.
  Reveal and delete go through the editor's own `revealFileInOS` and a trash
  delete (`workspace.fs.delete` with `useTrash`), so nothing is shelled out and
  neither editor is branched on.

## Visibility

The icon appears only when the recorder is running for this chat **or** there is
at least one still-existing file to show; otherwise it is hidden. The badge shows
the count (capped at `999+`); it turns amber when the ledger carries a `gap`, so
the count is known to be a lower bound.

## Why it is a patch and not a mod

As of 2.1.292 the VS Code extension never asks for or shows mod drawing, so any
visible panel UI must be a webview patch. See the repo's notes on that.
