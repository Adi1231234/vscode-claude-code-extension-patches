# agent-tree - the app's Agent map dialog becomes a collapsible sidebar tree of
# the conversation's agents and their background tasks; picking one swaps the
# conversation view for that agent's transcript while the chat keeps running.
#
# Three edits to webview/index.js, every anchor resolved before a byte is written:
#   1. the dialog's render site (`open && <AgentMap/>`) is removed from the chat
#      column ...
#   2. ... and rendered always, with its open flag, as the first child of the
#      chat view's root row - so the sidebar sits beside the chat, not over it;
#   3. the dialog's own component hands its props to ours, with the app's own
#      pieces (status dot, tree builder, transcript view, ...) in a kit.
. (Join-Path $PSScriptRoot 'anchors.ps1')

function Find-AgentTreeSite {
    param([string]$Text, [string]$Name)
    $a = $script:AgentTreeAnchors[$Name]
    $m = Find-NearLiteral $Text $a.Literal $a.Pattern -Before $a.Before -After $a.After
    if ($m.Count -ne 1) { Write-Miss "$Name anchor not found ($($m.Count) matches)"; return $null }
    return $m[0]
}

function Invoke-Patch {
    param($Ctx)

    if (-not (Test-Path $Ctx.WebJs)) { Write-Miss 'webview/index.js not found'; return }
    $wc = Read-Text $Ctx.WebJs
    if ($wc.Contains('/* AGENTTREE */')) { Write-Skip 'already patched'; return }

    $site = @{}
    foreach ($name in $script:AgentTreeAnchors.Keys) {
        $site[$name] = Find-AgentTreeSite $wc $name
        if (-not $site[$name]) { return }
    }
    $g = { param($n, $k) $site[$n].Groups[$k].Value }

    $layoutCall = Get-InjectedJs (Join-Path $PSScriptRoot 'runtime/layout-call.js') ([ordered]@{
        '__SETOPEN__' = & $g mapCall 7; '__OPEN__' = & $g mapCall 1; '__JSX__' = & $g mapCall 2
        '__MAP__' = & $g mapCall 3; '__SESSION__' = & $g mapCall 4; '__CONTEXT__' = & $g mapCall 5
        '__ROW__' = & $g mapCall 6
    })
    $kitCall = Get-InjectedJs (Join-Path $PSScriptRoot 'runtime/kit-call.js') ([ordered]@{
        '__JSX__' = & $g mainRow 1; '__TRACK__' = & $g mapBody 1; '__USESTATE__' = & $g mapBody 2
        '__WAITING__' = & $g mapBody 3; '__USEMEMO__' = & $g mapBody 4; '__BUILDTREE__' = & $g mapBody 5
        '__WITHPARENTS__' = & $g withParents 1
        '__STATUS__' = & $g agentRow 2; '__LIST__' = & $g agentRow 4; '__DOTSTATE__' = & $g agentRow 6
        '__DOT__' = & $g agentRow 5; '__LABELS__' = & $g labels 1; '__TRANSCRIPT__' = & $g transcript 1
        '__AGENTTIME__' = & $g agentMeta 1; '__TASKLABEL__' = & $g taskRow 1; '__TASKTIME__' = & $g taskRow 2
        '__TASKOUTPUT__' = & $g taskOut 1; '__OWNER__' = & $g owner 1
    })

    # Splice from the end of the file backwards, so each index is still true.
    # The kit goes in right after the dialog component's opening brace.
    $edits = @(
        @{ At = $site.mapCall.Index; Len = $site.mapCall.Length; Text = '' }
        @{ At = $site.layout.Index + $site.layout.Length; Len = 0; Text = $layoutCall.Trim() }
        @{ At = $site.mapBody.Groups['body'].Index; Len = 0; Text = $kitCall.Trim() }
    )
    $out = $wc
    foreach ($e in ($edits | Sort-Object { $_.At } -Descending)) {
        $out = $out.Substring(0, $e.At) + $e.Text + $out.Substring($e.At + $e.Len)
    }

    $runtime = (@('model.js', 'arrange.js', 'prefs.js', 'status.js', 'glyphs.js', 'rows.js', 'rail.js', 'filter.js', 'sidebar.js', 'pane.js', 'root.js') |
        ForEach-Object { Read-Text (Join-Path $PSScriptRoot "runtime/$_") }) -join "`n"
    Write-Text $Ctx.WebJs ("/* AGENTTREE */`n" + $runtime + "`n" + $out)
    Write-Ok 'agent tree sidebar in place of the Agent map dialog'

    Add-StyleBlock $Ctx (Join-Path $PSScriptRoot 'agent-tree.css') '/* AGENTTREECSS */' 'agent-tree CSS'
}
