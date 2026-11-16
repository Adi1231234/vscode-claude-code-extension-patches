# mcp-self-control

Two tools Claude can call itself, so it stops asking you to open `/mcp` and press
Reconnect:

- `mcp__claude-vscode__mcp_server_status` - every MCP server of this chat with
  its status (`connected`, `failed`, `needs-auth`, `pending`, `disabled`), its
  connection error, its scope and transport, and how many tools it has.
- `mcp__claude-vscode__reconnect_mcp_server` - reconnects one server by name and
  returns its status afterwards. With no name it reconnects every server that is
  not connected (disabled ones are left alone). A `needs-auth` server stays that
  way: signing in is yours.

Each chat only sees and touches its own servers.

## Why a patch: there is no built-in way

Checked on 2.1.325 (2026-11-16):

- The Skill tool refuses `/mcp` with a fixed message: "mcp is a UI command, not
  a skill. Ask the user to run /mcp themselves". This is hard-coded, not a
  permission you can grant.
- `/mcp reconnect <server>|all` exists since 2.1.284 (docs: commands, mcp), but
  only a person can type it.
- The issues asking for a way in were closed without one: #57207 (`claude mcp
  reconnect`), #51561 (reconnect all), #42627 and #60953 (from a hook).
- A mod can't do it either. `$.mcp.connect` "never dials" a server that failed.
  `$.command.run` waits until the session is idle, so a tool can't use it
  mid-turn.

## How

The extension builds an in-process MCP server, `claude-vscode`, for every chat
it launches (`launchClaude` hands it to `registerVSCodeMcpServerTools`). That is
where `getDiagnostics` comes from. The patch registers the two tools on that
same server, right after the app's own. The anchor captures the chat's channel
id and the server's parameter name from the launch.

`registerTool` takes a zod shape, so the tools need the bundle's own
`z.string`. They get it from the `getDiagnostics` schema, where the app calls
it: that call becomes `(globalThis.__ccZodString = () => Z(), Z())`, and the
app's own call is unchanged. It is read there and never passed from the launch.
The zod name is minified per release (`qe` on 2.1.325, `n.string` on 2.1.306),
and at the launch a short name like `n` can be one of `launchClaude`'s own
parameters. The first version of this patch passed it from the launch and would
have broken every chat on 2.1.306.

Registering the tools never throws, because it runs inside the chat's launch:
without zod, the chat starts with the app's tools alone. The tools call the session's `mcpServerStatus()` and the extension's
own `reconnectMcpServer(channel, name)`. That sends the CLI the Agent SDK's
`mcp_reconnect` request, the same call as the MCP dialog's Reconnect button.
Nothing here opens a connection of its own.

`claude-vscode` itself is never reconnected. That would cut the call that asked
for it.

## Proven

- `tests/tools.test.js`: status rows, reconnect by name, reconnect with no name
  (only servers that are not connected, never itself), an unknown name, one
  failure among several, a closed chat.
- End to end, on the extension's own 2.1.325 CLI through Agent SDK 0.3.325 (the
  version the extension bundles), with `host/tools.js` wired the way the
  patched launch wires it:
  - An HTTP server answering 404 stays `failed`, because Claude Code never
    retries a not-found by itself.
  - The server was then made healthy, and one prompt was sent.
  - In that one turn Claude read the status (`failed` and the error), called
    `reconnect_mcp_server` on it, got `connected` with one tool back, and
    called that tool. So the CLI serves `mcp_reconnect` while it waits on the
    result of the tool that sent it.
- `[ok]` and `node --check` on 2.1.294, 2.1.296, 2.1.301, 2.1.306, 2.1.319 and
  2.1.325. Each anchor matches once in all of them.
- A parser check on all six patched bundles: `this` at the call site is
  `launchClaude`'s, and the channel name is bound by `launchClaude`'s first
  parameter, with no nearer binding.

## Limits

- VS Code and Cursor only. The terminal CLI and the desktop app have no
  `claude-vscode` server.
- The host half: `extension.js` loads once per window, so a window open across
  `apply.ps1` only gets the tools after `Developer: Reload Window`.
