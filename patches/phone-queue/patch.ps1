# Phone queue: /queue in the Claude app (Remote Control) sees and steers the
# panel's prompt queue. Four pieces, every anchor resolved before a byte is
# written - a /queue command with no host behind it answers nothing:
#
#   <ext>/patches-mods/phone-queue   the Claude Code mod (mod/), loaded with
#                    every other patch's mod from that folder (lib/Mods.ps1)
#   extension.js     the host runtime (host/listen.js + panels.js + server.js)
#                    prepended, a __ccphone hook on every chat webview, and two
#                    edits to the CLI spawn: the mods folder (lib/Mods.ps1,
#                    shared) and the server's address (env, last, so it wins
#                    over one inherited from whatever started the editor)
#   extension.js     the panel script (webview/link.js), after the queue's,
#                    because it drives window.__qRemote, which that one defines
#
# Mods need Claude Code 2.1.287 or later; on an older CLI the flag is accepted
# and the mod simply does not load.
# Mods ship in 2.1.287. Below it there is nothing for the mod to run in, and the
# spawn code is shaped differently anyway (2.1.280 has no env anchor of this
# shape) - so an older install is left alone with the reason, not a [miss] that
# reads like drift.
$MinVersion = [version]'2.1.287'

function Invoke-Patch {
    param($Ctx)

    if ($Ctx.Version -lt $MinVersion) {
        Write-Info "needs Claude Code $MinVersion or later for /queue (mods); this install is $($Ctx.Version) - left alone, update it in the editor"
        return
    }
    if (-not (Test-Path $Ctx.Js)) { Write-Miss 'extension.js not found'; return }
    $js = Read-Text $Ctx.Js
    if ($js.Contains('/* PHONEQUEUEHOST */')) { Write-Skip 'host already patched'; return }
    # The panel half drives the queue's own surface; without the queue's script
    # there is nothing to drive, and a host with no panel half would answer
    # every /queue with a timeout.
    if (-not $js.Contains('/* QUEUE */')) { Write-Miss 'the prompt-queue panel script is not there - nothing for /queue to drive'; return }

    # The env assignment beside pathToClaudeCodeExecutable / executableArgs in
    # the SDK options spawnClaude builds. It sits in spawnClaude's own body,
    # where `this` is the panel's comms object - host/env.js hands its
    # `webview` to the server, which is how a /queue finds the panel that
    # spawned its CLI. Ours goes at the env object's end: what is between its
    # braces is captured, not spelled out, and a nested object there is a miss
    # rather than a guess.
    #
    # The two ends are the site: the options object getting its executable, and
    # that same object's env. Up to 2.1.300 the env came straight after; 2.1.301
    # moved it into the launch closure (`;let v={},P=async(o,p)=>{O.env=`), an
    # arrow function, so `this` is still the comms object. What lies between is
    # crossed, not spelled out. Since 2.1.318 the object holds one nested object
    # (a gated `{...}` spread), so one level of nesting is allowed; deeper, or a
    # `;`, is a miss.
    $js = Add-ModsToSpawn $js
    if (-not $js) { Write-Miss 'CLI spawn extraArgs anchor not found exactly once'; return }
    $rxEnv = '([\w$]+)\.pathToClaudeCodeExecutable=[\w$]+,\1\.executableArgs=[\w$]+[,;][\s\S]{0,200}?' +
             '\1\.env=\{(?:[^{};]|\{[^{};]*\})+(?=\})'
    $js = Add-AfterOnly $js $rxEnv (Read-Text (Join-Path $PSScriptRoot 'host/env.js')).Trim() '.pathToClaudeCodeExecutable='
    if (-not $js) { Write-Miss 'CLI spawn env anchor not found exactly once'; return }
    $js = Add-WebviewMessageHook $js (Join-Path $PSScriptRoot 'host/hook.js')
    if (-not $js) { Write-Miss 'webview message listener not found'; return }

    $modDir = Install-Mod $Ctx (Join-Path $PSScriptRoot 'mod') 'phone-queue'
    $hostJs = (Read-Text (Join-Path $PSScriptRoot 'host/listen.js')).Trim() + "`n" +
              (Read-Text (Join-Path $PSScriptRoot 'host/panels.js')).Trim() + "`n" +
              (Read-Text (Join-Path $PSScriptRoot 'host/server.js')).Trim()
    Write-Text $Ctx.Js ("/* PHONEQUEUEHOST */`n" + $hostJs + "`n" + $js)
    Write-Ok "/queue host + mod ($modDir)"

    $link = Get-InjectedJs (Join-Path $PSScriptRoot 'webview/link.js') @{ '__NONCE__' = $Ctx.Nonce }
    Add-ScriptAfterMarker $Ctx $link.Trim() '/* PHONEQUEUE */' '/queue panel link' @('/* QUEUE */')
}
