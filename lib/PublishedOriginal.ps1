# The original of a bundle, from the extension as it was published.
#
# A bundle that is already patched and has no .pristine beside it was patched by a
# patcher from before .pristine existed (lib/Pristine.ps1). Its original is not
# lost: it is that exact version of the extension on Open VSX. Measured
# 2026-11-23: the three bundles of the 2.1.330 VSIX there are byte-for-byte the
# .pristine files a fresh install kept. So the original is fetched and kept as
# the .pristine, and the run goes on as if it had always been there.
#
# Fetched only in that case (one download of 100-180 MB, once per install: the
# .pristine stays). If the download fails, or what arrives is patched itself,
# nothing is written and the caller reports the bundle as before.

# 'anthropic.claude-code-2.1.227-win32-x64' -> 2.1.227 + 'win32-x64';
# a universal build has no platform part.
function Get-PublishedVsixUrl($Ctx) {
    if ($Ctx.Name -notmatch '-(\d+\.\d+\.\d+)(?:-(.+))?$') { return $null }
    $v = $Matches[1]; $platform = $Matches[2]
    $base = 'https://open-vsx.org/api/Anthropic/claude-code'
    if ($platform) { return "$base/$platform/$v/file/Anthropic.claude-code-$v@$platform.vsix" }
    return "$base/$v/file/Anthropic.claude-code-$v.vsix"
}

# Writes "<file>.pristine" for each of $Files from the published VSIX. Returns
# the files it wrote.
function Save-PublishedOriginals {
    param([Parameter(Mandatory)]$Ctx, [Parameter(Mandatory)][string[]]$Files, [Parameter(Mandatory)][string[]]$Guards)
    $url = Get-PublishedVsixUrl $Ctx
    if (-not $url) { return @() }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = Join-Path ([System.IO.Path]::GetTempPath()) ("ccp-vsix-" + [guid]::NewGuid().ToString("N") + ".zip")
    $saved = @()
    try {
        Write-Info "no original kept - fetching $($Ctx.Version) as published, to keep it"
        (New-Object System.Net.WebClient).DownloadFile($url, $zip)
        $archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
        try {
            foreach ($file in $Files) {
                $rel = $file.Substring($Ctx.Dir.TrimEnd('\').Length + 1) -replace '\\', '/'
                $entry = $archive.GetEntry("extension/$rel")
                if (-not $entry) { continue }
                $pristine = "$file.pristine"
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $pristine, $true)
                if (Test-AlreadyPatched -Path $pristine -Guards $Guards) { Remove-Item $pristine; continue }
                Write-Ok "kept the published original as $([System.IO.Path]::GetFileName($pristine))"
                $saved += $file
            }
        } finally { $archive.Dispose() }
    } catch {
        Write-Miss "could not fetch the published original: $($_.Exception.Message)"
    } finally {
        Remove-Item $zip -Force -ErrorAction SilentlyContinue
    }
    return $saved
}
