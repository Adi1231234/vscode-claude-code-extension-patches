# agent-tree

**Type:** feature
**Touches:** `webview/index.js`, `webview/index.css`
**Guard markers:** `/* AGENTTREE */`, `/* AGENTTREECSS */`

The app's **Agent map** dialog becomes a **sidebar beside the chat**: a tree of
this conversation's agents, each with its background tasks under it.

- **Collapsed by default.** A 32px rail with one button and a count of what is
  running. The footer's agents pill and `/agents` open it (they used to open
  the dialog); the arrow at its top folds it back.
- **A tree.** The main conversation is the root, its agents under it, nested the
  way they spawned each other (the app's own tree builder, the one the dialog
  used). Every row with something under it has a disclosure arrow.
- **Running vs ended.** A running row keeps full colour, a bold label and the
  app's busy dot, pulsing; an ended one is dimmed with a grey dot (red when it
  failed, amber when it waits for a permission). Its meta line says which, with
  the elapsed time and tokens.
- **Picking an agent shows its transcript** - the app's own "Open transcript"
  view - in place of the conversation. The conversation is not replaced: it
  stays mounted under the view, so it keeps running, keeps its scroll position
  and its draft, and is there unchanged after **Back to main conversation**, a
  click on the root row, or Escape. A running agent has **Stop agent**.
- **Picking a background task** shows its live output (the app's own view, for
  shell tasks) with **Stop**.

## Which agent a background task belongs to

The store keeps no owner on a task, but it can be worked out: each task carries
the id of the tool call that started it (`toolUseId`, from the CLI's
`task_started`), and that call sits in the conversation's message list tagged
with the agent it ran in (`parent_tool_use_id`, the same tag the app uses to
nest agents). So a task goes under that agent, and an untagged call means the
main conversation. When the call is no longer in the list (the store trims it on
long chats) the owner cannot be known, and the task is listed under
"Background tasks, agent unknown" instead of being guessed. Only running tasks
are listed - the store drops a task once it ends, as the dialog did.

## How it is wired

Three edits to `webview/index.js`, all resolved before anything is written
(`anchors.ps1`):

1. the dialog's render site in the chat column (`open && <AgentMap/>`) is removed;
2. the same component is rendered always, with its open flag, as the first child
   of the chat view's root row (`sessionLayout`), so the sidebar takes its own
   space instead of covering the chat;
3. the dialog's own component returns ours instead (`runtime/kit-call.js`),
   handing over the app's pieces it needs: the status dot and labels, the tree
   builder, the transcript view, the task output view, the time and token line,
   and the call-owner lookup. Every one of those names is captured, never
   written down.

The picked agent's view is laid over the chat (`position: absolute` in
`sessionLayout`) rather than swapped for it, which is what keeps the chat alive.
Below 500px the app stacks its row into a column, and so does this: the rail is
a strip along the top and a picked agent takes the whole view.

Everything is drawn by the app's own renderer from its own store signals, so
nothing polls and no DOM observer is added; the sidebar carries `data-cc` so the
shared watcher of the other patches ignores its updates.
