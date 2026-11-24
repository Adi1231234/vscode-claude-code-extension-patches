# agent-input - the message box talks to the agent on screen. While an agent's
# view is open (patches/agent-tree), Enter sends what is typed to that agent
# instead of the main conversation; the queue above the box is that agent's
# own lane (patches/prompt-queue).
#
#   webview/index.js  the chat's submit handler sends through
#                     __ccAgentInput.route(session) (webview/route.js), with the
#                     shared target and agent-store runtimes ahead of it
#   extension.js      a "cc_agent_send" request beside the app's own
#                     stop_subagent, answered by host/deliver.js, and the mods
#                     folder on the CLI's spawn (lib/Mods.ps1)
#   patches-mods/agent-input   the mod the host hands the message to while the
#                     CLI's own send_task_message answers "Unsupported"
#
# Every anchor is resolved before a byte is written, and each bundle carries
# its own guard: a webview half with no host half would send into nothing.
$MinVersion = [version]'2.1.287'

$C = '([\w$]+)'
# The chat's submit, the one session.send the panel makes for a typed message.
$SendRx = "await $C\.send\($C,$C,$C,\{kind:`"human`"\},\{inlinePastes:$C\}\)"
$SendLit = ',{kind:"human"},{inlinePastes:'
# The host's request switch, at the app's own request for an agent.
$CaseRx = "case`"stop_subagent`":return await this\.stopSubagent\($C\.channelId,"

function Find-AgentInputSite {
    param([string]$Text, [string]$Literal, [string]$Pattern, [string]$Name)
    $m = Find-NearLiteral $Text $Literal $Pattern -Before 120 -After 160
    if ($m.Count -ne 1) { Write-Miss "$Name not found ($($m.Count) matches)"; return $null }
    $m[0]
}

function Get-AgentInputRuntime {
    param($Ctx)
    $parts = @((Get-LibJsPath 'ccStore.js'), (Get-LibJsPath 'ccTarget.js'), (Get-LibJsPath 'ccAgentStore.js'),
        (Join-Path $PSScriptRoot 'webview/route.js'))
    $text = ($parts | ForEach-Object { (Read-Text $_).Trim() }) -join "`n"
    $classes = Expand-CssClasses $Ctx $text
    # Only the Escape guard reads app classes: without them it would also take
    # an Escape meant for an open menu, so the guard is what goes.
    foreach ($m in $classes.Missing) { Write-Miss "app class $m not found" }
    if ($classes.Missing.Count) { return $null }
    $classes.Text
}

function Invoke-Patch {
    param($Ctx)

    if ($Ctx.Version -lt $MinVersion) {
        Write-Info "needs Claude Code $MinVersion or later (mods); this install is $($Ctx.Version) - left alone"
        return
    }
    foreach ($f in @($Ctx.Js, $Ctx.WebJs)) { if (-not (Test-Path $f)) { Write-Miss "$f not found"; return } }
    $wc = Read-Text $Ctx.WebJs
    $js = Read-Text $Ctx.Js
    if ($wc.Contains('/* AGENTINPUT */') -and $js.Contains('/* AGENTINPUTHOST */')) { Write-Skip 'already patched'; return }
    if ($wc.Contains('/* AGENTINPUT */') -or $js.Contains('/* AGENTINPUTHOST */')) { Write-Miss 'only one half is in place - restore the pristine bundles and run again'; return }

    $send = Find-AgentInputSite $wc $SendLit $SendRx 'the chat submit send'
    $case = Find-AgentInputSite $js 'case"stop_subagent":' $CaseRx 'the host request switch'
    $runtime = Get-AgentInputRuntime $Ctx
    if (-not $send -or -not $case -or -not $runtime) { return }
    $js = Add-ModsToSpawn $js
    if (-not $js) { Write-Miss 'CLI spawn extraArgs anchor not found exactly once'; return }
    # Add-ModsToSpawn may have put text in front: find the case again.
    $case = Find-AgentInputSite $js 'case"stop_subagent":' $CaseRx 'the host request switch'
    if (-not $case) { return }

    $call = (Get-InjectedJs (Join-Path $PSScriptRoot 'webview/send-call.js') @{ '__STORE__' = $send.Groups[1].Value }).Trim()
    $head = 'await ' + $send.Groups[1].Value + '.send('
    $wc = Set-MatchText $wc $send ($call + $send.Value.Substring($head.Length))
    $caseJs = (Get-InjectedJs (Join-Path $PSScriptRoot 'host/case.js') @{ '__MSG__' = $case.Groups[1].Value }).Trim()
    $js = Set-MatchText $js $case ($caseJs + $case.Value)

    $modDir = Install-Mod $Ctx (Join-Path $PSScriptRoot 'mod') 'agent-input'
    $hostJs = (Read-Text (Join-Path $PSScriptRoot 'host/deliver.js')).Trim()
    Write-Text $Ctx.Js ("/* AGENTINPUTHOST */`n" + $hostJs + "`n" + $js)
    Write-Text $Ctx.WebJs ("/* AGENTINPUT */`n" + $runtime + "`n" + $wc)
    Write-Ok "the message box sends to the agent on screen (host + mod $modDir)"
}
