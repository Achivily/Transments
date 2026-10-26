# Regenerates preview/main.png and preview/main.zh-CN.png from the release build in demo mode.
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-preview.ps1
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "target\release\transments.exe"
$grab = Join-Path $PSScriptRoot "grab_window.ps1"
& $grab -Exe $exe -Out (Join-Path $root "preview\main.png") -AppArgs "--demo --lang en" -Wait 3
& $grab -Exe $exe -Out (Join-Path $root "preview\main.zh-CN.png") -AppArgs "--demo --lang zh" -Wait 3
& $grab -Exe $exe -Out (Join-Path $root "preview\video.png") -AppArgs "--demo --lang en --mode video" -Wait 3
& $grab -Exe $exe -Out (Join-Path $root "preview\video.zh-CN.png") -AppArgs "--demo --lang zh --mode video" -Wait 3
& $grab -Exe $exe -Out (Join-Path $root "preview\compress.png") -AppArgs "--demo --lang en --mode compress" -Wait 3
& $grab -Exe $exe -Out (Join-Path $root "preview\compress.zh-CN.png") -AppArgs "--demo --lang zh --mode compress" -Wait 3
