# MCP self control - two tools on each chat's own "claude-vscode" MCP server, so
# Claude can read its MCP servers' status and reconnect one (or every one that
# is not connected) itself instead of asking the user to open /mcp. README.md.
#
#   (1) the chat launch, where the extension builds that chat's claude-vscode
#       server and hands it to registerVSCodeMcpServerTools: the chat's channel
#       id and the server's parameter name are captured there
#   (2) the getDiagnostics schema, where the app calls its own z.string: that
#       call also leaves a reference to it (host/zod.js). It is read there, in
#       its own scope, because at the launch a short minified name (`n`, `d` -
#       2.1.301 / 2.1.306) can be one of the launch's own locals
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
    # 1: up to the schema's first field  2: z.string, spelled `qe` or `$1.string`
    $rxString = '(registerTool\([\w$]+,\{description:[\w$]+,inputSchema:\{uri:)([\w$]+(?:\.string)?)\(\)(?=\.optional\(\))'

    $mLaunch = [regex]::Matches($js, $rxLaunch)
    $mString = [regex]::Matches($js, $rxString)
    if ($mLaunch.Count -ne 1) { Write-Miss "claude-vscode server hand-over matched $($mLaunch.Count) times, expected 1"; return }
    if ($mString.Count -ne 1) { Write-Miss "getDiagnostics zod schema matched $($mString.Count) times, expected 1"; return }
    $l = $mLaunch[0].Groups
    $zod = $mString[0].Groups[2].Value

    $call = (Get-InjectedJs (Join-Path $PSScriptRoot 'host/call.js') ([ordered]@{
        '__ARG__' = $l[3].Value; '__CHANNEL__' = $l[2].Value
    })).Trim()
    $js = Set-MatchText $js $mLaunch[0] ($l[1].Value + $call)

    # Matched again: the launch edit above moved everything after it.
    $s = [regex]::Match($js, $rxString)
    $keep = (Get-InjectedJs (Join-Path $PSScriptRoot 'host/zod.js') @{ '__ZOD__' = $zod }).Trim()
    $js = Set-MatchText $js $s ($s.Groups[1].Value + $keep)

    $tools = (Read-Text (Join-Path $PSScriptRoot 'host/tools.js')).Trim()
    Write-Text $Ctx.Js ("/* MCPSELFCONTROL */`n" + $tools + "`n" + $js)
    Write-Ok "mcp_server_status + reconnect_mcp_server on claude-vscode (channel: $($l[2].Value), zod: $zod)"
}
