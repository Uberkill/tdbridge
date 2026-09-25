$ErrorActionPreference = "Stop"
$WorkingDir = $PSScriptRoot
Set-Location $WorkingDir

Clear-Host
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "      TOUCHDESIGNER MOBILE CONTROLLER - ONE CLICK       " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Setting everything up for you. Please wait a few seconds..." -ForegroundColor Yellow
Write-Host ""

# 1. Start the Node.js "Brain" in a separate window so users can see the Room Code
Write-Host "[1/3] Starting the local Relay Server..." -ForegroundColor Yellow
Stop-Process -Name "node" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Launch node in a new visible window so they can see the generated Room Code
Start-Process -FilePath "cmd.exe" -ArgumentList "/c title TD_Bridge_Brain && node src\server\relay.js" -WindowStyle Normal

# 2. Start Cloudflare Tunnel
Write-Host "[2/3] Generating your public Internet Link..." -ForegroundColor Yellow
Stop-Process -Name "cloudflared" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$LogFile = "$WorkingDir\tunnel.log"
if (Test-Path $LogFile) { Remove-Item $LogFile }
$ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
$ProcessInfo.FileName = "$WorkingDir\cloudflared.exe"
$ProcessInfo.Arguments = "tunnel --url http://127.0.0.1:8080"
$ProcessInfo.RedirectStandardError = $true
$ProcessInfo.UseShellExecute = $false
$ProcessInfo.CreateNoWindow = $true

$Process = New-Object System.Diagnostics.Process
$Process.StartInfo = $ProcessInfo
$Process.Start() | Out-Null

Write-Host "[3/3] Waiting for Cloudflare..." -ForegroundColor Yellow
$NewUrl = ""
$attempts = 0

while ($NewUrl -eq "" -and $attempts -lt 15) {
    Start-Sleep -Seconds 2
    $output = $Process.StandardError.ReadLine()
    if ($output -match "https://(.*\.trycloudflare\.com)") {
        $NewUrl = "https://" + $Matches[1]
    }
    $attempts++
}

if ($NewUrl -eq "") {
    Write-Host "ERROR: Could not get Cloudflare URL. Check your internet connection." -ForegroundColor Red
    Stop-Process -Id $Process.Id
    pause
    exit
}

Clear-Host
Write-Host "========================================================" -ForegroundColor Green
Write-Host "                   SUCCESS! SYSTEM LIVE                 " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your TouchDesigner bridge is fully up and running."
Write-Host ""
Write-Host "🔗 YOUR SHAREABLE LINK:" -ForegroundColor Cyan
Write-Host "   $NewUrl" -ForegroundColor White -BackgroundColor Blue
Write-Host ""
Write-Host "📱 WHAT TO DO NEXT:" -ForegroundColor Yellow
Write-Host "  1. Send the link above to anyone's phone (or open it on yours)."
Write-Host "  2. Look at the other black window (TD_Bridge_Brain) to see the 4-letter ROOM CODE."
Write-Host "  3. Open your TouchDesigner file (e.g. VJ_Talo.toe) if you haven't already."
Write-Host "  4. Type the room code into the phone, hit Join, and start playing!"
Write-Host ""
Write-Host "IMPORTANT: Keep both this window and the 'Brain' window open while playing."
Write-Host "Press Ctrl+C here to stop everything and close the internet connection."
Write-Host "========================================================" -ForegroundColor Cyan

while ($true) {
    Start-Sleep -Seconds 1
}
