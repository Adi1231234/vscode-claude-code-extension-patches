# phone-sessions-history

**Type:** bug fix
**Touches:** `extension.js`
**Guard marker:** `/* PHONESESSIONSHISTORY */`

A conversation started from the phone (Remote Control, the Claude app or
claude.ai/code) never shows up in the editor's Session history, so it cannot be
picked up on the PC. With this patch it is listed with the folder's other
conversations and opens like any of them.

## Root cause (proven)

1. **Every phone session is an SDK run.** `claude remote-control` starts each
   session as a child CLI with `--print --sdk-url <url> --input-format
   stream-json --output-format stream-json`. The CLI sets its entrypoint to
   `sdk-cli` for any non-interactive run (and turns an inherited `cli` into
   `sdk-cli`), so every record of a phone transcript says
   `"entrypoint":"sdk-cli"`.
2. **The history list drops SDK runs unless asked not to.** The list reader
   skips a transcript when `!includeProgrammatic` and its entrypoint (head
   first, then tail) is `sdk-cli`, `sdk-ts` or `sdk-py`, or its `sessionKind`
   is `daemon` / `daemon-worker`.
3. **The editor never asks.** The list is called with
   `sessionListOptions(){return{dir:this.cwd,includeWorktrees:...,includeProgrammatic:this.includeProgrammaticSessions}}`.
   The base comms class answers `get includeProgrammaticSessions(){return!0}`,
   and the editor's comms class overrides it with
   `return Boolean(<cfg>("claudeProcessWrapper"))` - true only for someone who
   set `claudeCode.claudeProcessWrapper`. Same code in 2.1.330, 2.1.331 and
   2.1.332.

Measured on 2026-11-28 through each panel's own host channel
(`connection.value.listSessions("history")`) in a running editor: this repo
listed 29 of 29 editor sessions and 0 of 5 phone sessions, pic2desk 38 of 38
and 0 of 8, docvoice 0 of 5 phone sessions. Four copies of one phone
transcript that differed only in `entrypoint` (`sdk-cli` / `claude-vscode`)
and in folder (its `bridge-*` worktree / the main checkout) were listed
exactly when the entrypoint was `claude-vscode`; the folder made no
difference.

## What it does

The editor's override is replaced by the base class's answer:

```
get includeProgrammaticSessions(){/* PHONESESSIONSHISTORY */return!0}
```

Only the history list reads this getter (`sessionListOptions`); the other
listers and the lookup by id already include SDK sessions. Nothing in a
transcript tells a phone session apart from any other SDK run (a script using
the Agent SDK in that folder), so those are listed too. On the machine this was
measured on there were 9 such transcripts outside Remote Control (6 of them
under `%TEMP%`) and no `daemon` session at all.

Relabelling the phone sessions' entrypoint instead (from the tool that starts
`remote-control`) was rejected: the CLI decides real behaviour on it.

Anchored on the getter's name, the `"claudeProcessWrapper"` literal and the
shape around them; the settings reader is captured as `[\w$]+`. A reshaped
getter is a `[miss]` and writes nothing.

## Verified

In the lab on 2.1.332, two real phone transcripts copied in unchanged
(`entrypoint` still `sdk-cli`, only `cwd` pointed at the lab folder):

- patched: the history list returned both;
- the same bundle with only this getter put back to the original, after a real
  window reload: 0;
- patched again: both, and picking one in Session history rendered its 58
  messages, ready to continue.

Exposes a single `Invoke-Patch $Ctx` (dot-sourced and called by
`../../apply.ps1`). Idempotent and fail-safe.
