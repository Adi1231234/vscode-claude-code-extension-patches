# agent-input

**Type:** feature
**Touches:** `webview/index.js`, `extension.js`, plus a Claude Code mod copied beside them
**Guard markers:** `/* AGENTINPUT */` (panel), `/* AGENTINPUTHOST */` (host)
**Needs:** Claude Code **2.1.287** or later (mods); measured on **2.1.331**

While one of the conversation's agents is on screen (`patches/agent-tree` opens
its view in the conversation's place), the panel's message box talks to that
agent: Enter sends what is typed to it, and the queue above the box is that
agent's own lane (`patches/prompt-queue/queue/lanes.js`), with everything the
queue has - Alt+Enter, the add button, schedules, saved queues. Leaving the
view, or Escape in the box, gives the box back to the main conversation.

- **A running agent reads a message at its next step** (its next tool
  round). **A finished one is woken by it** and carries on; the main
  conversation then hears from it again, as when it first finished.
- **What you sent is drawn in the agent's view as your message**
  (`patches/agent-tree/runtime/typed-rows.js`).
- **Text only.** An attachment is refused and put back with the reason, and so
  is a slash command (it runs in the main conversation). The commands the panel
  runs itself (`/status` and the like) still open as usual.
- **Escape in the box goes back to the main conversation.** The app's own
  Escape stops the main conversation's turn, and with a foreground agent that
  stops the agent too; the agent's view has its own Stop.

## How a message travels

1. **The panel.** The chat's submit handler ends in `session.send(...)`; the
   patch points that one call at `__ccAgentInput.route(session)`
   (`webview/route.js`). With the main conversation on screen that is the
   session itself, unchanged. With an agent on screen
   (`lib/js/ccTarget.js`) it is the agent's store (`lib/js/ccAgentStore.js`),
   which asks the host `{ type: "cc_agent_send", taskId, agentId, text }` on
   the chat's own request channel.
2. **The host** (`host/deliver.js`, answered ahead of the app's own
   `stop_subagent`) hands it to the conversation's CLI through the SDK query
   every panel request goes through:
   - first the CLI's own request for exactly this, `send_task_message`;
   - when that is refused, the `agent-input` mod's `SendToAgent` tool, by
     `mcp_call` with `check_permissions`.
3. **The mod** (`mod/hooks/register.js`) runs `$.session.send({ to: { agentId } })`
   - the SendMessage tool's own delivery. Its tool is never offered to the
   model, and allowed without asking (the person typed the message).

## Facts it is built on (2.1.331, measured)

- **The CLI already has the request, and refuses it.** `send_task_message`
  (`task_id`, message) is in every allow list and in the set that acts at once,
  next to `interrupt` and `stop_task`; its handler answers
  `Unsupported control request subtype: send_task_message`
  (`error_code: unsupported_request`). The terminal already lets you type to
  the agent you view. So the host tries it first, and the day it is filled in
  the mod stops being used, with nothing to change here.
- **Every user frame the panel sends goes to the main agent.** A
  `parent_tool_use_id` on an incoming frame is not a route.
- **A mod's tool answers a host only through the model's tool path.** A plain
  `mcp_call` goes straight to the plugin's MCP server, whose only answer is
  "no hook answered this call"; with `check_permissions` the call runs
  `tool.check` / `tool.run`, and a `tool.run` that answers comes back as
  `The tool did not run: The result went to the host that asked for this call.`
  - the CLI's words for a result that is the host's and never the model's. A
  deny comes back after `The tool did not run: `, so the mod prefixes its own
  reasons with `agent-input: `.
- **The message reaches the agent as a queued meta row** with origin
  `{ kind: "coordinator", plugin: "agent-input" }`; one that wakes a finished
  agent comes inside the CLI's own words ("The coordinator sent a message
  while you were working: ..."). It is never in the store's live rows, only
  in the agent's transcript, which the CLI writes every 100 ms.
- **The mods load from one folder.** `lib/Mods.ps1` hands the CLI
  `<ext>/patches-mods` as its one `--plugin-dir`: a folder with no plugin
  marker of its own loads every child that has a manifest. So this mod and
  `phone-queue`'s sit side by side, and neither patch edits the spawn twice.

## Limits

- The agent sees the message as one from the main conversation (the
  coordinator), not as the person's: that is how `$.session.send` frames a
  plugin's message. `send_task_message`, once the CLI fills it in, may carry it
  as the person's own.
- A conversation whose CLI started before the patch has no mod: the reason
  says to restart it.

## Tests

    node patches/agent-input/tests/run-all.mjs   # host delivery, agent store, mods folder

Checked for real in `tools/lab` on 2.1.331 with Haiku agents: a message sent
while the agent ran reached it at its next step and was drawn there, one sent
to a finished agent woke it, Alt+Enter queued an item in the agent's own lane
(held, the agent being idle) and Play sent it, the main lane kept sending
behind the agent's view, a slash command was refused and put back, and Escape
went back to the main conversation without stopping it.
