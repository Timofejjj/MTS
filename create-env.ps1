# Скрипт для создания .env файла
$envPath = "$PSScriptRoot\backend\.env"
$examplePath = "$PSScriptRoot\backend\env.example"

if (Test-Path $envPath) {
    Write-Host "⚠️  Файл .env уже существует!" -ForegroundColor Yellow
    $overwrite = Read-Host "Перезаписать? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "Отменено." -ForegroundColor Gray
        exit
    }
}

Write-Host "📝 Создаю .env файл..." -ForegroundColor Cyan

# Копируем из примера
Copy-Item $examplePath $envPath -Force

# Генерируем случайный JWT_SECRET
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Заменяем JWT_SECRET на случайный
(Get-Content $envPath) -replace 'your_super_secret_jwt_key_change_in_production', "mts_iaas_$jwtSecret" | Set-Content $envPath

Write-Host "✅ Файл .env создан!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Следующие шаги:" -ForegroundColor White
Write-Host "   1. Открой backend\.env" -ForegroundColor Gray
Write-Host "   2. Заполни Google Sheets credentials:" -ForegroundColor Gray
Write-Host "      - GOOGLE_SHEETS_ID" -ForegroundColor Gray
Write-Host "      - GOOGLE_SERVICE_ACCOUNT_EMAIL" -ForegroundColor Gray
Write-Host "      - GOOGLE_PRIVATE_KEY" -ForegroundColor Gray
Write-Host ""
Write-Host "   Подробная инструкция в README.md" -ForegroundColor Cyan
