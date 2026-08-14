$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Out = Join-Path $Root "dist"
$Stamp = Get-Date -Format "yyyyMMdd"

if (Test-Path $Out) {
  Remove-Item -Recurse -Force $Out
}
New-Item -ItemType Directory -Path (Join-Path $Out "assets") | Out-Null

Copy-Item (Join-Path $Root "index.html") $Out
Copy-Item (Join-Path $Root "styles.css") $Out
Copy-Item (Join-Path $Root "assets\*") (Join-Path $Out "assets") -Recurse -Force

$Zip = Join-Path $Root "bspbuddy-website-$Stamp.zip"
if (Test-Path $Zip) {
  Remove-Item -Force $Zip
}
Compress-Archive -Path (Join-Path $Out "*") -DestinationPath $Zip -Force

Write-Host "[website] done: $Out"
Write-Host "[website] zip:  $Zip"
