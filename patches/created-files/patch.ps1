# created-files - a header icon with a live count of the files THIS chat created
# that still exist, and a dialog listing them with reveal / delete / copy-all.
#
# The files themselves are recorded by the Adi Tools helper (adi-tools,
# resources/createdFiles) into a shared per-chat ledger; this patch only reads
# that ledger and draws the panel. Two coupled edits, every anchor resolved
# before a byte is written:
#
#   webview/index.js  the runtime (shared lib/js + runtime/*) prepended, and the
#                     header button inserted beside Session history
#   extension.js      the ledger reader + live pusher prepended, plus a routing
#                     guard at every chat surface's onDidReceiveMessage
#
# Reveal and delete use the editor's own APIs (revealFileInOS, trash delete), so
# nothing is shelled out and neither editor is branched on.
function Invoke-Patch {
    param($Ctx)

    if (-not (Test-Path $Ctx.WebJs)) { Write-Miss 'webview/index.js not found'; return }
    if (-not (Test-Path $Ctx.Js)) { Write-Miss 'extension.js not found'; return }

    $wc = Read-Text $Ctx.WebJs
    $js = Read-Text $Ctx.Js
    if ($wc.Contains('/* CREATEDFILES */') -and $js.Contains('/* CREATEDFILESHOST */')) {
        Write-Skip 'already patched'; return
    }

    # (1) The header icon group: the same signature panel-restart-button uses - a
    # zero-width lookahead on the Session history + New session buttons - so we
    # capture the app's jsx factory and its icon-button component without
    # consuming or retyping anything. Insert our button right before it.
    $rxBtn = '(?=([\w$]+)\(([\w$]+),\{ref:[\w$]+,ariaLabel:"Session history",iconSize:20,.{0,60}?\}\),' +
             '\1\(\2,\{ariaLabel:"New session",iconSize:20,onClick:\(\)=>\{' +
             'if\(!([\w$]+)\.startNewConversationTab\(\)\)([\w$]+)\.createSession\(\)\})'
    $btn = Find-NearLiteral $wc 'ariaLabel:"Session history",iconSize:20,' $rxBtn -Before 200 -After 600
    if ($btn.Count -ne 1) { Write-Miss "header button anchor not found ($($btn.Count) matches)"; return }

    # (2) The host listener - resolved now, written only once (1) is good.
    $hooked = Add-WebviewMessageHook $js (Join-Path $PSScriptRoot 'host/hook.js')
    if (-not $hooked) { Write-Miss 'webview message listener not found'; return }

    # Shared webview runtimes (self-guarded, so re-including is a no-op), then our
    # own, in dependency order: ccStore before ccSession, dom/watch before state,
    # the modal before the dialog.
    $libs = @('ccStore.js', 'ccDom.js', 'ccWatch.js', 'ccSession.js', 'ccModal.js', 'ccMenu.js', 'ccCopyText.js') |
        ForEach-Object { Get-LibJsPath $_ }
    $mine = @('icon.js', 'link.js', 'size.js', 'state.js', 'glyphs.js', 'parts.js', 'feedback.js', 'rowMenu.js', 'dirRow.js', 'agents.js', 'rows.js', 'dialog.js') |
        ForEach-Object { Join-Path $PSScriptRoot "runtime/$_" }
    $runtime = (($libs + $mine) | ForEach-Object { Read-Text $_ }) -join "`n"

    $call = (Get-InjectedJs (Join-Path $PSScriptRoot 'runtime/button-call.js') ([ordered]@{
        '__JSX__' = '${1}'; '__BUTTON__' = '${2}'
    })).Trim()

    # Each host part takes what the ones before it define, so they go in the order
    # host/load-order.json gives (the tests load them from the same list).
    $hostOrder = Read-Text (Join-Path $PSScriptRoot 'host/load-order.json') | ConvertFrom-Json
    $hostJs = ($hostOrder | ForEach-Object { Read-Text (Join-Path $PSScriptRoot "host/$_") }) -join "`n"

    Write-Text $Ctx.WebJs ("/* CREATEDFILES */`n" + $runtime + "`n" + (Set-MatchText $wc $btn[0] $btn[0].Result($call)))
    Write-Text $Ctx.Js ("/* CREATEDFILESHOST */`n" + $hostJs.Trim() + "`n" + $hooked)
    Write-Ok 'created-files icon + dialog in the panel header'

    # The dialog chrome, which otherwise arrives only with prompt-queue.
    Add-StyleBlock $Ctx (Get-LibCssPath 'ccModal.css') '/* QMODAL */' 'shared dialog CSS'
    Add-StyleBlock $Ctx (Get-LibCssPath 'ccMenu.css') '/* CCMENUCSS */' 'shared menu CSS'
    Add-StyleBlock $Ctx (Join-Path $PSScriptRoot 'created-files.css') '/* CREATEDFILESCSS */' 'created-files CSS'
    Add-StyleBlock $Ctx (Join-Path $PSScriptRoot 'created-files-tree.css') '/* CREATEDFILESTREECSS */' 'created-files tree CSS'
}
