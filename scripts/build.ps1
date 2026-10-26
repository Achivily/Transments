# Release build. libheif (HEIC/AVIF) is linked statically from vcpkg:
#   vcpkg install "libheif[core,hevc,libde265,aom]:x64-windows-static-md"
# Set VCPKG_ROOT to your vcpkg checkout (defaults to E:\vcpkg).
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1 [-Test]
param([switch]$Test)
if (-not $env:VCPKG_ROOT) { $env:VCPKG_ROOT = "E:\vcpkg" }
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  if ($Test) { cargo test; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
  cargo build --release
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
  New-Item -ItemType Directory -Force dist | Out-Null
  Copy-Item target\release\transments.exe dist\Transments-2.0.0-x64.exe -Force
  Get-Item dist\Transments-2.0.0-x64.exe | ForEach-Object { "{0}  {1:N0} bytes" -f $_.Name, $_.Length }
} finally { Pop-Location }
