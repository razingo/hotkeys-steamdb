# Builds the ZIP to upload to the Chrome Web Store, Firefox Add-ons and Edge Add-ons.
# Usage: powershell -ExecutionPolicy Bypass -File build.ps1
# Output: dist/popup-hotkeys-for-steamdb-<version>.zip, with manifest.json at the top level.
# Older builds in dist/ are removed first, so the only ZIP there is the one to upload.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = $PSScriptRoot
$version = ( Get-Content -Raw -Encoding UTF8 ( Join-Path $root 'manifest.json' ) | ConvertFrom-Json ).version

# Only what the extension loads, plus the license. README, docs/, build files and .git stay out.
# tests/helpers.js reads this list too (so the tests check what really ships): keep one 'quoted' name per line.
# A file the manifest or options.html loads has to be here, or the ZIP won't work. The tests check that.
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

# Clear out earlier builds: old ZIPs, folders they were unzipped into, and the unpacked copy the checks use.
# Only names this script (or its checks) create are touched, anything else in dist/ stays.
Get-ChildItem -Path $dist -Filter 'popup-hotkeys-for-steamdb-*' | ForEach-Object {
	Remove-Item -Recurse -Force -LiteralPath $_.FullName

	# The current version's ZIP is rebuilt right below, so it isn't really an old build
	if( $_.FullName -ne $zipPath )
	{
		Write-Host "Removed old build: $( $_.Name )"
	}
}

$unpacked = Join-Path $dist 'extension'

if( Test-Path $unpacked )
{
	Remove-Item -Recurse -Force -LiteralPath $unpacked
}

$zip = [System.IO.Compression.ZipFile]::Open( $zipPath, 'Create' )
$finished = $false

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

	$finished = $true
}
finally
{
	$zip.Dispose()

	# A build that stopped halfway leaves a ZIP that looks finished but has files missing. Don't keep it around.
	if( -not $finished )
	{
		Remove-Item -LiteralPath $zipPath -ErrorAction SilentlyContinue
	}
}

Write-Host "Built $zipPath ($( $files.Count ) files)"
