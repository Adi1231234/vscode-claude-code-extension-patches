# The Claude Code mods the patches ship, and the one spawn edit that loads them.
#
# A patch with a mod copies it to <ext>/patches-mods/<name> (Install-Mod). The
# chat CLI is spawned with that folder as its one --plugin-dir
# (Add-ModsToSpawn, lib/js/ccMods.js). A folder with nothing at its top that
# marks it as one plugin is "a folder of plugins": the CLI loads every child
# that has a manifest. Measured on 2.1.331: "--plugin-dir <dir> is a folder of
# plugins (nothing at its top marks it as one plugin): loading agent-input,
# phone-queue", and a child with no .claude-plugin/plugin.json is left out
# ("no manifest in agent-input"). So a patch adds its folder and never edits
# the spawn itself; whichever runs first makes that edit (guard /* CCMODS */).
$script:ModsDir = 'patches-mods'

# Insert $New right after the single match of $Rx, or $null when it does not
# match exactly once - two sites would mean the anchor no longer knows which
# one it is looking at. $Literal: the text right after the identifier a
# pattern opens with, so the search starts there (lib/Anchor.ps1) instead of
# trying every position of the bundle.
function Add-AfterOnly {
    param([string]$Text, [string]$Rx, [string]$New, [string]$Literal)
    $m = if ($Literal) { Find-IdentifierAnchored $Text $Literal $Rx } else { [regex]::Matches($Text, $Rx) }
    if ($m.Count -ne 1) { return $null }
    Set-MatchText $Text $m[0] ($m[0].Value + $New)
}

function Copy-ModTree {
    param([string]$From, [string]$To)
    foreach ($f in Get-ChildItem $From -Recurse -File -Force) {
        $dest = Join-Path $To $f.FullName.Substring($From.Length).TrimStart('\', '/')
        New-Item -ItemType Directory -Force (Split-Path $dest -Parent) | Out-Null
        Write-Text $dest (Read-Text $f.FullName)
    }
}

# Copies a patch's mod beside extension.js, where the spawn's --plugin-dir
# points. Returns the folder it went to, relative to the extension.
function Install-Mod {
    param($Ctx, [string]$From, [string]$Name)
    $rel = "$script:ModsDir/$Name"
    Copy-ModTree $From (Join-Path $Ctx.Dir $rel)
    $rel
}

# extension.js with the mods folder handed to the chat CLI's spawn, or $null
# when the spawn's extraArgs is not found exactly once. Since 2.1.322 the
# bundled SDK's query() builds an `extraArgs:{` of its own, and 2.1.323's
# prompt-suggestions helper a third; the chat spawn's is the one that carries
# "replay-user-messages" - another would load the mods into every SDK query,
# or into a throwaway haiku process.
function Add-ModsToSpawn {
    param([string]$Js)
    if ($Js.Contains('/* CCMODS */')) { return $Js }
    $arg = (Read-Text (Get-LibJsPath 'ccModsArg.js')).Trim()
    $out = Add-AfterOnly $Js 'extraArgs:\{(?=[^{}]*"replay-user-messages":null)' $arg
    if (-not $out) { return $null }
    $runtime = Get-InjectedJs (Get-LibJsPath 'ccMods.js') @{ '__MODSDIR__' = $script:ModsDir }
    "/* CCMODS */`n" + $runtime.Trim() + "`n" + $out
}
