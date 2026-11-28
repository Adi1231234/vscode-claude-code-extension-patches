# Sessions started from the phone (Remote Control) show in the history list
# (see README.md for the proof).
#
# The history list drops every session whose transcript says it was started by
# the SDK (entrypoint sdk-cli / sdk-ts / sdk-py), unless the list is asked to
# include them. The base comms class asks for them; the editor's comms class
# says no, and a phone session is always stamped sdk-cli, so it never shows.
# The editor's answer becomes the base class's. Two shapes of it:
#   getter (2.1.3xx)  get includeProgrammaticSessions(){return Boolean(<cfg>("claudeProcessWrapper"))}
#   field  (2.1.294)  ...;includeProgrammaticSessions=!1;...   (the base class has =!0)
# Opening a session by id never filters, so the list is the only place.
function Invoke-Patch {
    param($Ctx)
    $js = Read-Text $Ctx.Js
    if ($js.Contains('/* PHONESESSIONSHISTORY */')) { Write-Skip 'already patched'; return }

    $shapes = @(
        @{ Js = 'getter.js'; Rx = 'get includeProgrammaticSessions\(\)\{return Boolean\([\w$]+\("claudeProcessWrapper"\)\)\}' },
        @{ Js = 'field.js'; Rx = '(?<=[;{])includeProgrammaticSessions=!1(?=;)' }
    )
    $sites = @()
    foreach ($s in $shapes) {
        $new = (Get-InjectedJs (Join-Path $PSScriptRoot "js/$($s.Js)")).Trim()
        foreach ($m in [regex]::Matches($js, $s.Rx)) { $sites += [pscustomobject]@{ M = $m; New = $new } }
    }
    if ($sites.Count -eq 0) { Write-Miss "the editor's includeProgrammaticSessions override not found"; return }

    # Back to front, so every recorded index still points at its own match.
    foreach ($s in ($sites | Sort-Object { $_.M.Index } -Descending)) { $js = Set-MatchText $js $s.M $s.New }
    Write-Text $Ctx.Js $js
    Write-Ok "phone sessions listed in history ($($sites.Count) site(s))"
}
