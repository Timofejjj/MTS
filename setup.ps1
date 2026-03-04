# MTS IaaS Platform — First-time Setup Script
Write-Host "⚙️  MTS IaaS Platform — Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Install backend deps
Write-Host "`n📦 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
npm install

# Install frontend deps
Write-Host "`n📦 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"
npm install

Set-Location $PSScriptRoot

Write-Host "`n✅ Dependencies installed!" -ForegroundColor Green
Write-Host "`n📋 Next steps:" -ForegroundColor White
Write-Host "  1. Copy backend\env.example to backend\.env and fill Google Sheets credentials" -ForegroundColor Gray
Write-Host "  2. Run: cd backend && node src/scripts/seed.js   (to seed demo data)" -ForegroundColor Gray
Write-Host "  3. Run: .\start-dev.ps1   (to start both servers)" -ForegroundColor Gray
Write-Host "`n📖 Google Sheets setup:" -ForegroundColor White
Write-Host "  - Create a Google Spreadsheet" -ForegroundColor Gray
Write-Host "  - Create a Service Account in Google Cloud Console" -ForegroundColor Gray
Write-Host "  - Enable Google Sheets API" -ForegroundColor Gray
Write-Host "  - Share the Spreadsheet with the service account email" -ForegroundColor Gray
Write-Host "  - Copy Spreadsheet ID from URL and service account credentials to .env" -ForegroundColor Gray
