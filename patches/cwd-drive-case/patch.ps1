# Sessions started from the IDE cannot be resumed: "cannot resume into worktree".
# VS Code / Cursor derive every workspace path from a file:// URI, and URI.fsPath
# lower-cases the drive letter, so the extension launches the CLI in "c:\project".
# git reports the same directory as "C:/project", and Claude Code >= 2.1.222
# compares the two case-sensitively when it adopts an isolation worktree -> it
# refuses and the process exits 1. Fix: upper-case the drive letter on the cwd
# handed to the SDK query every panel session is launched through, so the
# spelling the CLI records is the one Windows itself reports. See README.md.
#
# The site has two fixed ends, `{cwd:` and `,resume:<id>,canUseTool:`, and what
# lies between is captured, not spelled out: up to 2.1.322 it was a variable,
# since 2.1.323 it is the workspace-trust conditional
# (`T.viaProcessWrapper===!1&&w.kind==="trusted"?w.directory:b`). A comma or a
# brace in it is a miss rather than a guess. The inserted expression lives in
# js/sdk-cwd-expr.js; its __V1__ / __V2__ placeholders map to the capture groups.
function Invoke-Patch {
    param($Ctx)
    $js = Read-Text $Ctx.Js
    if ($js.Contains('/* CWDDRIVECASE */')) { Write-Skip 'already patched'; return }

    $rxSdk = '\{cwd:([^,{}]+?),resume:([\w$]+),canUseTool:'
    $sdk = ([regex]$rxSdk).Matches($js).Count
    if ($sdk -ne 1) { Write-Miss "SDK launch cwd anchor matched $sdk times, expected 1"; return }

    $sdkExpr = (Get-InjectedJs (Join-Path $PSScriptRoot 'js\sdk-cwd-expr.js') ([ordered]@{
        '__V1__' = '${1}'; '__V2__' = '${2}'
    })).Trim()
    $js = [regex]::Replace($js, $rxSdk, $sdkExpr)

    $helper = (Read-Text (Join-Path $PSScriptRoot 'js\drive-case.js')).Trim()
    Write-Text $Ctx.Js ("/* CWDDRIVECASE */`n" + $helper + "`n" + $js)
    Write-Ok 'launch cwd normalised to the canonical drive-letter spelling (SDK query)'
}
