# agent-tree

**Type:** feature
**Touches:** `webview/index.js`, `webview/index.css`
**Guard markers:** `/* AGENTTREE */`, `/* AGENTTREECSS */`

The app's **Agent map** dialog becomes a **sidebar beside the chat**: a tree of
this conversation's agents, each with its background tasks under it.

- **Only once there is something to show.** A conversation that has not started
  an agent or a background task gets no sidebar and gives up no width. From the
  first one on it stays, since ended agents stay listed.
- **Collapsed by default, and still usable collapsed.** A 32px rail: a button
  that opens the tree, then a tile for the main conversation (a chat glyph) and
  one per agent in tree order. An agent's tile is the first letter of its
  description with the app's status dot on its corner (pulsing while it runs,
  the letter dimmed once it ended), and its tooltip says the status and the
  full description. The open conversation's tile carries a 2px bar on the
  rail's edge, the way VS Code's activity bar marks its open view. Clicking a
  tile switches to that conversation exactly as its tree row does, so the
  agents can be moved between without opening the tree. The footer's agents
  pill and `/agents` open the tree (they used to open the dialog); the arrow at
  its top folds it back.
- **Active first, and only active by default.** At every level the agents
  with something running come first: the agent itself runs or waits for a
  permission, or an agent it spawned or a task it started does
  (`runtime/arrange.js`). An "Only active agents" switch under the header, on
  by default, leaves out the agents with nothing running in or under them and
  says how many it hid; the agent on screen always stays. The rail shows the
  same agents in the same order. The choice is kept in the panel's
  localStorage, shared by the window's Claude panels.
- **Tooltips, not the browser's title** (`runtime/tip.js`, `tip-content.js`,
  `agent-tree-tip.css`). One box for the whole sidebar, opened 8px to the
  right of what it describes and centred on it, drawn to the app's only hover
  tooltip (the composer's microphone hint: menu colours, 6px corner, its soft
  shadow, a .1s fade after .4s; the next item shows at once). An agent's says
  its name, status line, what it is doing now (the app's progress summary, or
  its latest tool) and what it was asked; a background task's says how long
  it has run and the command it runs, read off the tool call that started it;
  a control's says what pressing it does. It lives in the chat's row, so the
  sidebar's scrolling never clips it, and it follows the store while it shows.
  The app's renderer makes enter/leave out of `mouseover`/`mouseout`, which is
  what a test has to dispatch.
- **The open tree** has a header that says how many agents and tasks are
  running, a 1px indent guide per level (as VS Code draws its own trees), the
  status word in its status colour (Working, Failed, waiting), and a glyph that
  tells the main conversation and a background task apart from an agent.
  Spacing comes from one scale (2 / 4 / 8 / 12), listed at the top of
  `agent-tree.css`, and was checked by measuring the rendered panel.
- **A tree.** The main conversation is the root, its agents under it, nested the
  way they spawned each other (the app's own tree builder, the one the dialog
  used). Every row with something under it has a disclosure arrow.
- **Running vs ended.** A running row keeps full colour, a bold label and the
  app's busy dot, pulsing; an ended one is dimmed with a grey dot (red when it
  failed, amber when it waits for a permission). Its meta line says which, with
  the elapsed time and tokens.
- **Picking an agent shows its transcript** - the app's own "Open transcript"
  view - in place of the conversation. The conversation is not replaced: it
  stays mounted under the view, so it keeps running, keeps its scroll position,
  and is there unchanged after **Back to main conversation**, a click on the
  root row, or Escape. A running agent has **Stop agent**.
- **The message box stays under the agent's view, and talks to that agent**
  (`patches/agent-input`). The view ends at the top of the box
  (`runtime/inset.js`: a ResizeObserver keeps its bottom on the box's top as
  the box grows - a permission card, a long draft, the queue panel), so the
  permission cards drawn in the box's place are answered right there. A line
  under the transcript says the box talks to this agent, what it does with a
  message (read at its next step, or woken by it), and why the last one did
  not go (`runtime/to-agent.js`). `runtime/target.js` tells the box which
  agent is on screen (`lib/js/ccTarget.js`).
- **What you sent an agent is drawn in its transcript as your message.** The
  app's transcript view has no way to show it: a message reaches the agent as
  a meta row from "the coordinator", which the view leaves out (or, un-marked,
  draws as "Sender not recorded"), and it is never in the store's live rows.
  So the view fetches through a session whose transcript un-marks those rows,
  and the row renderer draws them as the person's, holding just what was typed
  - the CLI wraps a message that wakes an agent in words of its own
  (`runtime/typed-rows.js`). While a message is not in the view yet, the view
  fetches again on each state of the agent and each row it streams, 300 ms
  after it: the CLI writes the transcript every 100 ms, and a fetch made at the
  event itself read the file without the message
  (`runtime/transcript-session.js`).
- **The agent's view looks like the main conversation.** It wears the app's
  own conversation-list classes (`messagesContainer`, `stickyMode`, and
  `fullEditor` exactly when the app uses it), filled in from the bundle's
  CSS-module map (`runtime/app-classes.js`). So it gets the same background
  (which `panel-background` evens out), the same 20px gutters, scrolling and
  sticky prompts, and the rtl patch's direction for the messages. Before, the
  app's transcript view sat as a lighter box on the side bar's colour, with its
  dialog's rule and gap on top. The header stays chrome: left to right, like
  the app's own header.
- **It opens at the newest row and follows the agent** (`runtime/follow.js`),
  with the rule the app pins its own list by: within 50px of the end it
  follows, scrolled up it lets go, back at the end it follows again. It reacts
  to the content growing (a ResizeObserver), not to a timer, and opening
  another agent starts at the end again.
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

The picked agent's view is laid over the chat's transcript (`position: absolute`
in `sessionLayout`, down to the message box) rather than swapped for it, which is
what keeps the chat alive. It sits under the box's layer, so the menus the box
opens upwards (/ and @) still draw over it.
Below 500px the app stacks its row into a column, and so does this: the rail is
a strip along the top and a picked agent takes the whole view.

Everything is drawn by the app's own renderer from its own store signals, so
nothing polls and no DOM observer is added; the sidebar carries `data-cc` so the
shared watcher of the other patches ignores its updates.
