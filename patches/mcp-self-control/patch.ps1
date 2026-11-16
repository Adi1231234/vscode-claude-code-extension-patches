# MCP self control - two tools on each chat's own "claude-vscode" MCP server, so
# Claude can read its MCP servers' status and reconnect one (or every one that
# is not connected) itself instead of asking the user to open /mcp. README.md.
#
#   (1) the chat launch, where the extension builds that chat's claude-vscode
#       server and hands it to registerVSCodeMcpServerTools: the chat's channel
#       id and the server's parameter name are captured there
#   (2) the getDiagnostics registration, for the bundle's zod string factory -
#       registerTool takes a zod shape, and this is the one the app's own tool uses
#   (3) host/tools.js prepended; the hand-over becomes "register the app's tools,
#       then ours" (host/call.js)
function Invoke-Patch {
    param($Ctx)

    if (-not (Test-Path $Ctx.Js)) { Write-Miss 'extension.js not found'; return }
    $js = Read-Text $Ctx.Js
    if ($js.Contains('/* MCPSELFCONTROL */')) { Write-Skip 'already patched'; return }

    # 1: everything up to the hand-over  2: the chat's channel id  3: the server
    $rxLaunch = '(channelId:([\w$]+),filePath:[\w$]+,oldContent:[\s\S]{0,800}?)' +
                '\(([\w$]+)\)=>this\.registerVSCodeMcpServerTools\(\3\)'
    # 1: z.string, as the app's own getDiagnostics schema spells it
    $rxString = 'registerTool\([\w$]+,\{description:[\w$]+,inputSchema:\{uri:([\w$]+)\(\)\.optional\(\)'

    $mLaunch = [regex]::Match($js, $rxLaunch)
    $mString = [regex]::Match($js, $rxString)
    if (-not $mLaunch.Success) { Write-Miss 'claude-vscode server hand-over in the chat launch not found'; return }
    if (-not $mString.Success) { Write-Miss 'zod string factory in the getDiagnostics schema not found'; return }
    $l = $mLaunch.Groups

    $call = (Get-InjectedJs (Join-Path $PSScriptRoot 'host/call.js') ([ordered]@{
        '__ARG__'     = $l[3].Value
        '__CHANNEL__' = $l[2].Value
        '__STRING__'  = $mString.Groups[1].Value
    })).Trim()
    $js = Set-MatchText $js $mLaunch ($l[1].Value + $call)

    $tools = (Read-Text (Join-Path $PSScriptRoot 'host/tools.js')).Trim()
    Write-Text $Ctx.Js ("/* MCPSELFCONTROL */`n" + $tools + "`n" + $js)
    Write-Ok "mcp_server_status + reconnect_mcp_server on claude-vscode (channel: $($l[2].Value), zod: $($mString.Groups[1].Value))"
}
