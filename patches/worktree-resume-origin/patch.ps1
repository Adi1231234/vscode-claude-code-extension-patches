# A session that entered a worktree itself is resumed from the folder it entered
# it from, not from inside the worktree - otherwise the CLI anchors it there and
# ExitWorktree silently stops working (see README.md for the proof).
#
# One site in extension.js: the host's dispatch of the panel's launch_claude
# message, where the cwd the panel asked for is handed to launchClaude. That cwd
# goes through __ccResumeOrigin first, which reads the session's own transcript
# and returns either the same folder or the one the session came from. The host
# runtime lives in host/*.js and is prepended; the replaced call is
# js/launch-call.js, whose __M__ maps to the message variable (a ${1} backref).
function Invoke-Patch {
    param($Ctx)
    $js = Read-Text $Ctx.Js
    if ($js.Contains('/* WORKTREERESUMEORIGIN */')) { Write-Skip 'already patched'; return }

    # The two ends of the site: the case label and the launchClaude call. What
    # lies between is captured and written back as it was - 2.1.331 put
    # `if(this.tookStartedChat(e))break;` there (a chat started ahead of the
    # panel, taken only for a new chat in the workspace folder, never a resume).
    $rx = 'case"launch_claude":((?:[^;{}]{1,120};)?)await this\.launchClaude\(([\w$]+)\.channelId,\2\.resume,\2\.cwd,'
    $n = ([regex]$rx).Matches($js).Count
    if ($n -ne 1) { Write-Miss "launch_claude dispatch anchor matched $n times, expected 1"; return }

    $call = (Get-InjectedJs (Join-Path $PSScriptRoot 'js/launch-call.js') ([ordered]@{ '__BETWEEN__' = '${1}'; '__M__' = '${2}' })).Trim()
    $js = [regex]::Replace($js, $rx, $call)

    $parts = @((Get-LibJsPath 'ccProjects.js'), (Get-LibJsPath 'ccTranscript.js')) +
             (@('host/worktree-record.js', 'host/origin.js') | ForEach-Object { Join-Path $PSScriptRoot $_ })
    $runtime = ($parts | ForEach-Object { (Read-Text $_).Trim() }) -join "`n"
    Write-Text $Ctx.Js ("/* WORKTREERESUMEORIGIN */`n" + $runtime + "`n" + $js)
    Write-Ok 'resumed worktree sessions launch from the folder they entered the worktree from'
}
