# Builds the ZIP to upload to the Chrome Web Store, Firefox Add-ons and Edge Add-ons.
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1
# Output: dist/popup-hotkeys-for-steamdb-<version>.zip, with manifest.json at the top level.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = $PSScriptRoot
$version = ( Get-Content -Raw -Encoding UTF8 ( Join-Path $root 'manifest.json' ) | ConvertFrom-Json ).version

# Only what the extension loads, plus the license. README, docs/, build files and .git stay out.
$files = @(
	'manifest.json'
	'background.js'
	'content.js'
	'shared.js'
	'steam-page-click.js'
	'options.html'
	'options.css'
	'options.js'
	'tabs.js'
	'LICENSE'
)
$files += Get-ChildItem -Path ( Join-Path $root 'icons' ) -Filter '*.png' | ForEach-Object { "icons/$( $_.Name )" }

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zipPath = Join-Path $dist "popup-hotkeys-for-steamdb-$version.zip"

if( Test-Path $zipPath )
{
	Remove-Item $zipPath
}

$zip = [System.IO.Compression.ZipFile]::Open( $zipPath, 'Create' )

try
{
	foreach( $file in $files )
	{
		$source = Join-Path $root $file

		if( -not ( Test-Path $source -PathType Leaf ) )
		{
			throw "Missing file: $file"
		}

		# Entry names use forward slashes; Firefox rejects ZIPs with backslash paths
		[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile( $zip, $source, $file, 'Optimal' ) | Out-Null
	}
}
finally
{
	$zip.Dispose()
}

Write-Host "Built $zipPath ($( $files.Count ) files)"
