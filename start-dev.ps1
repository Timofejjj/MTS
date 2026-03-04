# MTS IaaS Platform — Development Startup Script
Write-Host "🚀 Starting MTS IaaS Platform (Dev Mode)..." -ForegroundColor Cyan

# Start backend
Write-Host "▶ Starting backend on port 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start frontend
Write-Host "▶ Starting frontend on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Both servers starting..." -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:3001/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Demo credentials:" -ForegroundColor White
Write-Host "   Admin:  admin@mts.ru    / admin123" -ForegroundColor Gray
Write-Host "   Client: client@alpha.ru / client123" -ForegroundColor Gray
