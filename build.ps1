$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$manifestPath = Join-Path $PSScriptRoot 'manifest.json'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$dist = Join-Path $PSScriptRoot 'dist'
$packagePath = Join-Path $dist ("metadata-reload-{0}.xpi" -f $manifest.version)
$temporaryPath = Join-Path $dist ([Guid]::NewGuid().ToString() + '.xpi')

New-Item -ItemType Directory -Path $dist -Force | Out-Null
try {
    $archive = [IO.Compression.ZipFile]::Open($temporaryPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($directory in @('locale/', 'locale/en-US/')) {
            $archive.CreateEntry($directory) | Out-Null
        }
        foreach ($entry in @('manifest.json', 'bootstrap.js', 'locale/en-US/metadata-reload.ftl')) {
            $sourcePath = Join-Path $PSScriptRoot $entry
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $sourcePath, $entry) | Out-Null
        }
    } finally {
        $archive.Dispose()
    }

    Move-Item -LiteralPath $temporaryPath -Destination $packagePath -Force
} finally {
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath
    }
}

Write-Output $packagePath
