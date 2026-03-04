# Restart both servers
Write-Host "Restarting servers..." -ForegroundColor Cyan

# Kill existing Node processes on ports 3001 and 5173
Write-Host "Stopping existing servers..." -ForegroundColor Yellow
try {
    $conn3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
    if ($conn3001) { Stop-Process -Id $conn3001.OwningProcess -Force -ErrorAction SilentlyContinue }
} catch {}

try {
    $conn5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    if ($conn5173) { Stop-Process -Id $conn5173.OwningProcess -Force -ErrorAction SilentlyContinue }
} catch {}

Start-Sleep -Seconds 2

# Start backend
Write-Host "Starting backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"

Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "Servers restarted!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
