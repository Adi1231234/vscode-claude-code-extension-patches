# created-files: the whole feature, and how it was built

A record of what we are building, why, what was measured, and where each piece
lives, so a teammate (or a later session) can pick it up mid-stream.

## The problem (measured 2026-11-18)

Claude chats leave very large amounts of files on disk and never clean them:

- Scratchpad: `%TEMP%\claude\<project>\<session-id>\scratchpad`, one folder per
  chat, named by session id, **never deleted by the CLI** - 4,982 folders,
  60.9 GB in eight weeks on this machine.
- Worktrees: 404 folders, 221 GB.
- Files written with the Write tool: mostly real, committed work (~1,900 of them
  tracked in git, ~25 untracked).
- **Files made by commands / scripts / builds: no record anywhere** - 20,192 of
  20,205 recent untracked files in 290 worktrees came this way. This is the
  category nothing could previously see, and the reason the recorder exists.

On 2026-11-19 the drive hit 366 MB free of 930 GB (0.0%), which is the condition
this feature is meant to make visible and fixable.

## The shape of the solution

Three parts, built across two repos:

1. **Phase 0 - the recorder** (repo `adi-tools`, PR #48). An elevated Windows
   helper that watches the kernel's file events and writes, per chat, an
   append-only ledger of the files that chat's processes created. This is the
   only part that needs admin, and it is the only way to attribute a
   command-created file to the chat that made it.
2. **Phase 2 - the Adi Tools tab** (repo `adi-tools`). A tab with a master
   on/off toggle for the recording and a live list of every chat and its
   still-existing created files.
3. **Phase 3 - the VS Code panel** (this repo, `patches/created-files`). A header
   icon with a live count badge for the current chat, and a dialog listing its
   files with reveal / delete / copy-all / delete-all. A pure reader of the
   ledger; no admin, nothing recorded here.

All three read one shared per-chat ledger (contract below).

## Why the recorder is the only way to attribute a file

To say which chat made a file, something must see the **process** that created
it and walk from it to the chat. Proven end to end 2026-11-19:

- A folder watcher (`FILE_NOTIFY_INFORMATION`) and the NTFS change journal
  (`USN_RECORD_V3`) both give the file and the action but **not the process**.
- Sysmon names the process but has **no file-rename event** (v15.22), and the
  CLI's own writer saves to `<name>.tmp.<pid>.<hex>` then renames onto the final
  name - so Sysmon would miss exactly the files Claude writes.
- The kernel ETW providers do carry the creating pid:
  `Microsoft-Windows-Kernel-File` CreateNewFile (30, keyword 0x1000), RenamePath
  (27, 0x800, FilePath = new name), DeletePath (26, 0x400);
  `Microsoft-Windows-Kernel-Process` ProcessStart (0x10) gives each process's
  parent **at start**, so a background process whose parent has exited still
  resolves to its chat.
- The process -> the chat: the CLI writes `~/.claude/sessions/<pid>.json`
  (`pid`, `sessionId`, `cwd`, `name`) for every running chat; walk a process's
  ancestry to the first pid that has one.
- Permissions, measured: enabling the kernel file provider is "Access is denied"
  even for a member of Performance Log Users, so the recorder runs as a
  RunLevel=Highest scheduled task, like Adi Tools' disk scanner.

## The ledger contract (owned by adi-tools/packages/created-files)

    %LOCALAPPDATA%\claude-code-patches\created-files\<sessionId>.jsonl
    %LOCALAPPDATA%\claude-code-patches\created-files\status.json

One JSON object per line: `op` of `new` / `rename` (file appeared; rename's
`path` is the final name) / `delete` / `gap` (recording was off across a window).
A reader replays the lines, ignoring case, then keeps only regular files that still
exist and are neither internal (`.git`, `~/.claude`, the CLI's temp files) nor
tracked by git. The ledger holds all of those too, so listing it unfiltered offers
a repository's objects and the chat's own transcript for deletion.
`status.json` carries `running`, `updatedAt` (fresh within ~2 s of activity,
never while idle, so a reader can tell it is alive), `lostEvents`, `gaps`.

## Measured results so far

- Recorder cost (adi-tools, 2026-11-19, under a 1,500-create + 1,500-delete
  burst): 0.33% of one core, 62 MB working set, 0 events lost. It is not in the
  path of any write - the kernel buffers and drops events rather than waiting.
- End to end: files made by PowerShell, cmd, Python, node, a process whose
  parent had exited, a temp-then-rename, and a delete all resolved to the right
  chat, while a second chat working at the same time got its own ledger.

## Status

- Phase 0 and Phase 2: adi-tools PR #49.
- Phase 3 (this repo): verified against the real 2.1.327 bundle and live in the lab
  against a synthetic ledger (`tests/host.test.js` covers the host half).

### A pre-existing break found and fixed along the way

On 2.1.327 the panel's message listener grew a wrapper:
`onDidReceiveMessage(Me((c)=>{` where earlier it was `((c)=>{`. The shared
`Add-WebviewMessageHook` anchor (lib/Patch.ps1) no longer matched, which had
**silently broken the host half of three shipped patches** - panel-settings
(notifications), panel-restart-button, and phone-queue - on 2.1.327. The anchor
now accepts the optional wrapper, restoring all three plus this one. (reload-
restore's separate `setupPanel` anchor is still drifted and is out of scope here.)
