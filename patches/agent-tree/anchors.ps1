# agent-tree - the sites it reads names from, and the two it writes at. Each is
# a literal to jump to plus the pattern around it (lib/Anchor.ps1); every name
# is captured, never written down (CLAUDE.md).
$C = '([\w$]+)'
$N = '[\w$]+'

$script:AgentTreeAnchors = [ordered]@{
    # The dialog's render site in the chat view: `open&&jsx(AgentMap,{...})`.
    mapCall = @{ Literal = ',renderTranscriptRow:('; Before = 120; After = 300
        Pattern = "$C&&$C\($C,\{session:$C,context:$C,renderTranscriptRow:(\($N,$N,$N\)=>$N\([^)]*\)),onClose:\(\)=>\{$C\(!1\),[^}]*\}\}\)," }
    # The chat view's root row, where the sidebar goes in as the first child.
    layout = @{ Literal = '.sessionLayout,'; Before = 40; After = 120
        Pattern = "className:$N\.sessionLayout,[^\[]{0,80}?children:\[" }
    # The dialog's own component (the tree that is replaced), and the hooks it uses.
    # Until 2.1.32x it read the agents and tasks from the store itself; since
    # then a wrapper passes them in as props (`agents`, `tasks`) - both shapes.
    mapBody = @{ Literal = 'title:"Agent map"'; Before = 600; After = 20
        Pattern = "function $N\(\{session:$N,context:$N,renderTranscriptRow:$N,onClose:$N(?:,agents:$N,tasks:$N)?\}\)\{(?<body>)$C\(\);let\[$N,$N\]=$C\(null\),[^;]*?$N=$C\($N\.permissionRequests\.value\),$N=$C\(\(\)=>$C\($N\),\[$N\]\)[^;]*;return $C\($N,\{title:`"Agent map`"" }
    # The store's agents with each one's parent filled in from the messages,
    # for the shape that has no `agents` prop.
    withParents = @{ Literal = '.agentMapAgents.value,'; Before = 10; After = 60
        Pattern = "\.agentMapAgents\.value,$N=$N\(\(\)=>$C\($N,$N\),\[$N,$N\]\)" }
    # The main-conversation row: the jsx factory for a single child.
    mainRow = @{ Literal = '{kind:"main"}'; Before = 120; After = 20
        Pattern = "children:\[$C\($N,\{session:$N,onClick:\(\)=>$N\(\{kind:`"main`"\}\)" }
    # An agent row: its status, the status dot, the list-item and map modules.
    # 2.1.294 had a data attribute on the button; 2.1.331 spreads one onto the
    # title - both optional.
    agentRow = @{ Literal = '.serverItem} ${'; Before = 80; After = 300
        Pattern = "let $C=$C\($C,$N\);return $N\(`"button`",\{type:`"button`",className:``\$\{$C\.serverItem\} \$\{$N\.row\}``,onClick:$N,title:\3\.description,(?:`"data-agent-status`":$N,)?children:\[$N\(`"span`",\{className:$N\.rowTitle,(?:\.\.\.$N\($N\),)?children:\[$N\($C,\{state:$C\(\1\)\}\)" }
    # The app's "Open transcript" view. 2.1.331 spreads an optional `waiting`
    # prop in before renderRow (empty at the app's own call site).
    transcript = @{ Literal = ',renderRow:'; Before = 100; After = 40
        Pattern = "$N\($C,\{session:$N,agent:$N,running:$N,(?:\.\.\.[^,{}]{1,40},)?renderRow:$N\},$N\.taskId\)" }
    # An agent's elapsed time and tokens.
    agentMeta = @{ Literal = '.rowMeta,children:'; Before = 30; After = 40
        Pattern = "className:$N\.rowMeta,children:$N\($C,\{agent:$N\}\)" }
    # A background task's label and elapsed time.
    taskRow = @{ Literal = '{state:"running"}),'; Before = 140; After = 160
        Pattern = "title:$C\($N\),(?:`"data-task-type`":$N\.taskType,)?children:\[$N\(`"span`",\{className:$N\.rowTitle,children:\[$N\($N,\{state:`"running`"\}\),$N\(`"span`",\{children:\1\($N\)\}\)\]\}\),$N\(`"span`",\{className:$N\.rowMeta,children:$N\($C,\{task:$N\}\)" }
    # A shell task's output view.
    taskOut = @{ Literal = '.taskType==="local_bash"&&'; Before = 10; After = 80
        Pattern = "\.taskType===`"local_bash`"&&$N\($C,\{session:$N,taskId:$N\.taskId,running:$N!==void 0\}\)" }
    # "Which agent ran this tool call": the agent's call id, null or undefined
    # for the main conversation, undefined for a call it cannot find either.
    owner = @{ Literal = '.sdkParentToolUseId!==void 0?'; Before = 220; After = 10
        Pattern = "function $C\($N,$N\)\{[^}]{0,200}?return $N\.sdkParentToolUseId!==void 0\?" }
    # The status labels (Working, Finished, ...), found by their own text: the
    # line that used them moved in 2.1.331, the table did not.
    labels = @{ Literal = '={working:"Working",waiting:'; Before = 40; After = 10
        Pattern = "$C=\{working:`"Working`",waiting:" }
}
