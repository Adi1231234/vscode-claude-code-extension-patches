# Subagent stream flags. The extension builds the SDK query options without
# `forwardSubagentText`, and with `agentProgressSummaries` explicitly undefined, so
# the CLI forwards only a subagent's tool calls and results (never its text or
# thinking) and never sends a rolling summary in `task_progress`. Both are plain
# init-config options; turning them on is display-only - they feed the SDK progress
# sink, not the parent's context and not the transcript.
# The replacement expression lives in js/flags.js; this file only anchors and writes.
function Invoke-Patch {
    param($Ctx)
    $js = Read-Text $Ctx.Js
    if ($js -match '/\* SUBAGENTFLAGS \*/') { Write-Skip 'already patched'; return }

    # The key itself, pinned to the query options by the key that follows it:
    # `agentProgressSummaries` alone appears again in the SDK client's initialize()
    # payload. Only the key is matched - its neighbour's value is upstream's
    # (promptSuggestions went from void 0 to !0 in 2.1.325, which is what broke the
    # old anchor that spelled the pair out), so it is neither matched nor rewritten.
    $m = [regex]::Matches($js, 'agentProgressSummaries:void 0(?=,promptSuggestions:)')
    if ($m.Count -ne 1) { Write-Miss "SDK query options anchor matched $($m.Count) times, expected 1"; return }

    $flags = (Get-InjectedJs (Join-Path $PSScriptRoot 'js/flags.js')).Trim()
    Write-Text $Ctx.Js ("/* SUBAGENTFLAGS */`n" + (Set-MatchText $js $m[0] $flags))
    Write-Ok 'subagent text + progress summaries forwarded'
}
