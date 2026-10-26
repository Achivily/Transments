# Launches Transments and captures its real window at true pixel size (PrintWindow, no supersampling).
# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/grab_window.ps1 -Exe target\release\transments.exe -Out shot.png [-AppArgs "--demo --lang zh"] [-Wait 3] [-Keep]
param([string]$Exe, [string]$Out, [string]$AppArgs = "", [int]$Wait = 3, [switch]$Keep)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public static class GrabT {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
  public static IntPtr Find(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, p) => {
      uint wp; GetWindowThreadProcessId(h, out wp);
      RECT r; GetWindowRect(h, out r);
      if (wp == pid && IsWindowVisible(h) && (r.R - r.L) > 300) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
[GrabT]::SetProcessDPIAware() | Out-Null
$p = if ($AppArgs) { Start-Process $Exe -ArgumentList $AppArgs -PassThru } else { Start-Process $Exe -PassThru }
$h = [IntPtr]::Zero
for ($i = 0; $i -lt 80 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 250; $h = [GrabT]::Find([uint32]$p.Id) }
if ($h -eq [IntPtr]::Zero) { Write-Error "window not found"; exit 1 }
Start-Sleep -Seconds $Wait
$r = New-Object GrabT+RECT
[GrabT]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.R - $r.L; $ht = $r.B - $r.T
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc(); [GrabT]::PrintWindow($h, $hdc, 2) | Out-Null; $g.ReleaseHdc($hdc)
$bmp.Save($Out)
Write-Output "$w x $ht -> $Out"
if (-not $Keep) { Stop-Process -Id $p.Id -Force }
