$ErrorActionPreference = "Stop"
$WorkingDir = "C:\Users\oob\.gemini\antigravity\scratch\TDBridge"
Set-Location $WorkingDir

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "      TD BRIDGE - ONE-CLICK START         " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "1. Starting Cloudflare Tunnel..." -ForegroundColor Yellow

# Kill any existing cloudflared process
Stop-Process -Name "cloudflared" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start tunnel and pipe output to a log file
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

Write-Host "2. Waiting for Internet URL..." -ForegroundColor Yellow
$NewUrl = ""
$attempts = 0

while ($NewUrl -eq "" -and $attempts -lt 15) {
    Start-Sleep -Seconds 2
    $output = $Process.StandardError.ReadLine()
    if ($output -match "https://(.*\.trycloudflare\.com)") {
        $NewUrl = "wss://" + $Matches[1]
    }
    $attempts++
}

if ($NewUrl -eq "") {
    Write-Host "ERROR: Could not get Cloudflare URL. Tunnel failed to start." -ForegroundColor Red
    Stop-Process -Id $Process.Id
    pause
    exit
}

Write-Host "Success! New URL: $NewUrl" -ForegroundColor Green
Write-Host "3. Updating App code..." -ForegroundColor Yellow

# Read app.ts, replace URL, and save
$AppTsPath = "$WorkingDir\src\client\app.ts"
$AppTs = Get-Content $AppTsPath
$AppTs = $AppTs -replace "wss://.*\.trycloudflare\.com", $NewUrl
Set-Content -Path $AppTsPath -Value $AppTs

Write-Host "4. Compiling TypeScript..." -ForegroundColor Yellow
npm run build:client | Out-Null

Write-Host "5. Uploading to GitHub Pages (Live Website)..." -ForegroundColor Yellow
git add .
git commit -m "Auto-Update Tunnel URL" | Out-Null
git push origin main | Out-Null

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "              SYSTEM READY!               " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Your TouchDesigner bridge is live on the internet."
Write-Host "Please wait ~60 seconds for GitHub to publish the update."
Write-Host "Keep this window open while you use the bridge."
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel when finished."

# Keep reading output so the process stays alive and visible
while ($true) {
    Start-Sleep -Seconds 1
}
