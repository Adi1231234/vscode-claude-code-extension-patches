# Where each supported VS Code build keeps its user extensions.
#
# The patches are for VS Code. Its builds (stable, Insiders, VSCodium) get the
# same bundles, so a patch never cares which one it is running against - only the
# *location* of the install differs. That knowledge lives here alone;
# Extension.ps1 builds the $Ctx for one install and apply.ps1 runs the patches
# over each.

$script:EditorRoots = @(
    @{ Editor = 'VS Code';          Dir = '.vscode' }
    @{ Editor = 'VS Code Insiders'; Dir = '.vscode-insiders' }
    @{ Editor = 'VSCodium';         Dir = '.vscode-oss' }
)

# Every extensions dir that actually exists, in the order declared above.
function Get-EditorExtensionRoots {
    param([string]$UserProfile = $env:USERPROFILE)

    foreach ($e in $script:EditorRoots) {
        $root = Join-Path $UserProfile (Join-Path $e.Dir 'extensions')
        if (Test-Path $root) { [pscustomobject]@{ Editor = $e.Editor; Root = $root } }
    }
}

# Label for an extensions dir - used for a dir passed in explicitly (a custom
# --extensions-dir), where the editor is only recognisable from the path.
function Get-EditorNameFromRoot {
    param([string]$Root)

    $parent = Split-Path (Split-Path $Root -Parent) -Leaf
    $match = $script:EditorRoots | Where-Object { $_.Dir -eq $parent } | Select-Object -First 1
    if ($match) { $match.Editor } else { 'custom dir' }
}
