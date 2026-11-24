# Every lib test in one PowerShell, so CI pays one start-up rather than one
# per file: lib/tests/*.test.ps1 for the PowerShell in lib/, *.test.js (run
# with node) for the shared runtime JS in lib/js/. Exits 1 when any of them
# failed. Run:
#   powershell -NoProfile -ExecutionPolicy Bypass -File lib/tests/run.ps1
$failed = @()
foreach ($t in Get-ChildItem $PSScriptRoot -Filter '*.test.*' | Where-Object { $_.Extension -in '.ps1', '.js' } | Sort-Object Name) {
    Write-Host "--- $($t.Name)"
    $global:LASTEXITCODE = 0
    try {
        if ($t.Extension -eq '.js') { & node $t.FullName } else { & $t.FullName }
    } catch { Write-Host "FAIL  threw: $($_.Exception.Message)"; $global:LASTEXITCODE = 1 }
    if ($LASTEXITCODE) { $failed += $t.Name }
}
if ($failed) { Write-Host "`nfailed: $($failed -join ', ')"; exit 1 }
