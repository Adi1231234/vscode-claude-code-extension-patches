# Put a finished copy of the app in place of the live one, all or nothing.
#
# The first installer emptied the live folder and extracted into it. On
# 2026-11-23 this machine had a live folder with claude.exe and 14 other top-level
# files and no resources/ at all - a refresh had died between the delete and the
# end of the extract - and the next run crashed on the missing app.asar. So the
# new copy is built and patched beside the live one, and only a complete one is
# moved in. A folder rename either happens or does not: one whose files are
# locked (the patched app open) fails before anything changes.

function Get-StagingDir([string]$appDir) { "$appDir.new" }

function Install-StagedApp([string]$staged, [string]$appDir) {
    $old = "$appDir.old"
    if (Test-Path $old) { Remove-Item -Recurse -Force $old }
    if (Test-Path $appDir) { Rename-Item $appDir (Split-Path $old -Leaf) }
    try {
        Rename-Item $staged (Split-Path $appDir -Leaf)
    } catch {
        if (Test-Path $old) { Rename-Item $old (Split-Path $appDir -Leaf) }
        throw
    }
    if (Test-Path $old) { Remove-Item -Recurse -Force $old -ErrorAction SilentlyContinue }
}

# Patched = the app's own archive is there and carries our marker. Reading the
# archive is the check, so its absence has to be asked first: Select-String on a
# missing path throws even under -ErrorAction SilentlyContinue once the caller's
# preference is Stop.
function Test-PatchedApp([string]$appDir) {
    $asar = Join-Path $appDir "resources\app.asar"
    (Test-Path (Join-Path $appDir "claude.exe")) -and (Test-Path $asar) -and
        [bool](Select-String -Path $asar -Pattern "CCDESK" -SimpleMatch -Quiet)
}
