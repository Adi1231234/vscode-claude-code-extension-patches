# session-status - the header's "Learn Claude Code" button gives its place to a
# power button that shows whether this chat's Claude process is running
# (green), starting, or stopped (red), and stops or starts it behind a confirm
# dialog. While the process is down, the red error banner it left stands down:
# the button and its dialog carry that error instead.
#
# One file, two sites, every anchor resolved before a byte is written:
#
#   the header   the Learn button's whole expression, replaced by a call into the
#                runtime with the app's own jsx factory, icon button, sessions and
#                context (js/button-call.js)
#   the banner   one line at the top of the error banner's body, after it has
#                worked out what the error offers (js/banner-guard.js)
#
# The runtime (runtime/*) reads the session store's own signals and calls its
# own methods; this checks they are in the bundle first.
function Invoke-Patch {
    param($Ctx)
    if (-not (Test-Path $Ctx.WebJs)) { Write-Miss 'webview/index.js not found'; return }
    $wc = Read-Text $Ctx.WebJs
    if ($wc.Contains('/* SESSIONSTATUS */')) { Write-Skip 'already patched'; return }

    # What the runtime calls. A release that renamed any of these would draw a
    # button that cannot tell or do what it says. (readyChannelIdSignal is read
    # when it is there: 2.1.294 has a plain field instead - runtime/state.js.)
    foreach ($need in 'claudeChannelIdSignal=', 'endProcess(){', 'async launchClaude(', 'async interrupt(){', 'openOutputPanel(){') {
        if (-not $wc.Contains($need)) { Write-Miss "the session store has no $need"; return }
    }

    # <gate>(<context>.isOnboardingEnabled.value)&&<shown>&&<jsx>(<iconButton>,{ref:..,ariaLabel:"Learn Claude Code",...})
    # and the sibling after it, <sessions>.activeSession.value&&... - the two ends
    # of the expression; what lies between is consumed whole, not spelled out.
    $rxLearn = '[\w$]+\(([\w$]+)\.isOnboardingEnabled\.value\)&&[\w$]+&&([\w$]+)\(([\w$]+),\{ref:[\w$]+,' +
               'ariaLabel:"Learn Claude Code",.{0,200}?\)(?=,([\w$]+)\.activeSession\.value&&)'
    $learn = Find-NearLiteral $wc 'ariaLabel:"Learn Claude Code",' $rxLearn -Before 200 -After 400
    if ($learn.Count -ne 1) { Write-Miss "Learn button anchor not found ($($learn.Count) matches)"; return }

    # function <banner>({error:<e>,...}){let <resume>=<f>(<e>)...;return <h>("div",{className:<m>.errorBanner,
    # - the guard goes in before that return. 2.1.332 has a second value in the
    # let (the startup failure kind) and 2.1.294 none; [^;]* takes either.
    $rxBanner = 'function [\w$]+\(\{error:([\w$]+),[^)]*\}\)\{let ([\w$]+)=[\w$]+\(\1\)[^;]*;' +
                '(?=return [\w$]+\("div",\{className:[\w$]+\.errorBanner,)'
    $banner = Find-NearLiteral $wc '.errorBanner,' $rxBanner -Before 600 -After 0
    if ($banner.Count -ne 1) { Write-Miss "error banner anchor not found ($($banner.Count) matches)"; return }

    $call = (Get-InjectedJs (Join-Path $PSScriptRoot 'js/button-call.js') ([ordered]@{
        '__JSX__' = '${2}'; '__BUTTON__' = '${3}'; '__SESSIONS__' = '${4}'; '__CONTEXT__' = '${1}'
    })).Trim()
    $guard = (Get-InjectedJs (Join-Path $PSScriptRoot 'js/banner-guard.js') ([ordered]@{
        '__RESUME__' = '${2}'
    })).Trim()

    $runtime = (@((Get-LibJsPath 'ccModal.js')) +
        (@('state.js', 'glyph.js', 'dom.js', 'actions.js', 'view.js', 'error-block.js', 'dialog.js', 'banner.js', 'button.js') |
            ForEach-Object { Join-Path $PSScriptRoot "runtime/$_" }) |
        ForEach-Object { Read-Text $_ }) -join "`n"

    # Both edits are spans of the text as read; the later one goes in first so
    # the earlier one's index still holds.
    $edits = @(
        @{ M = $banner[0]; New = $banner[0].Value + "`n" + $banner[0].Result($guard) + "`n" }
        @{ M = $learn[0]; New = $learn[0].Result($call) }
    ) | Sort-Object { $_.M.Index } -Descending
    foreach ($e in $edits) { $wc = Set-MatchText $wc $e.M $e.New }

    Write-Text $Ctx.WebJs ("/* SESSIONSTATUS */`n" + $runtime + "`n" + $wc)
    Write-Ok 'Claude process status button in the header, in place of Learn'

    Add-StyleBlock $Ctx (Get-LibCssPath 'ccModal.css') '/* QMODAL */' 'shared dialog CSS'
    Add-StyleBlock $Ctx (Join-Path $PSScriptRoot 'session-status.css') '/* SESSIONSTATUSCSS */' 'session status CSS'
}
