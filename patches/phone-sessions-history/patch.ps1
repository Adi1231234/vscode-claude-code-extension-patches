# Sessions started from the phone (Remote Control) show in the history list
# (see README.md for the proof).
#
# The history list drops every session whose transcript says it was started by
# the SDK (entrypoint sdk-cli / sdk-ts / sdk-py), unless the list is asked to
# include them. The base comms class asks for them (`return!0`); the editor's
# comms class overrides that with
#   get includeProgrammaticSessions(){return Boolean(<cfg>("claudeProcessWrapper"))}
# and a phone session is always stamped sdk-cli, so it never shows. The
# override is turned into the base class's answer. Only the list reads this
# getter (sessionListOptions); opening a session by id never filters.
function Invoke-Patch {
    param($Ctx)
    $js = Read-Text $Ctx.Js
    if ($js.Contains('/* PHONESESSIONSHISTORY */')) { Write-Skip 'already patched'; return }

    $rx = 'get includeProgrammaticSessions\(\)\{return Boolean\([\w$]+\("claudeProcessWrapper"\)\)\}'
    $sites = @([regex]::Matches($js, $rx))
    if ($sites.Count -eq 0) { Write-Miss 'includeProgrammaticSessions override not found'; return }

    $new = (Get-InjectedJs (Join-Path $PSScriptRoot 'include-programmatic-on.js')).Trim()
    # Back to front, so every recorded index still points at its own match.
    foreach ($m in ($sites | Sort-Object Index -Descending)) { $js = Set-MatchText $js $m $new }
    Write-Text $Ctx.Js $js
    Write-Ok "phone sessions listed in history ($($sites.Count) site(s))"
}
