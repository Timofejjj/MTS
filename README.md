# MTS IaaS Platform — Инструкция по запуску

## 🚀 Быстрый старт

### 1. Установка зависимостей

```powershell
# Установка всех зависимостей (backend + frontend)
.\setup.ps1

# Или вручную:
cd backend
npm install
cd ../frontend
npm install
```

### 2. Настройка Google Sheets API

#### Шаг 1: Создай Google Spreadsheet
1. Открой [Google Sheets](https://sheets.google.com)
2. Создай новую таблицу
3. Скопируй **ID таблицы** из URL:
   ```
   https://docs.google.com/spreadsheets/d/ВАШ_ID_ТАБЛИЦЫ/edit
   ```

#### Шаг 2: Создай Service Account
1. Открой [Google Cloud Console](https://console.cloud.google.com)
2. Создай новый проект (или выбери существующий)
3. Перейди: **APIs & Services** → **Credentials**
4. Нажми **Create Credentials** → **Service Account**
5. Заполни имя (например: `mts-iaas-service`)
6. Нажми **Create and Continue** → **Done**

#### Шаг 3: Создай ключ для Service Account
1. Открой созданный Service Account
2. Перейди на вкладку **Keys**
3. Нажми **Add Key** → **Create new key** → **JSON**
4. Скачается файл с ключом

#### Шаг 4: Включи Google Sheets API
1. В Google Cloud Console: **APIs & Services** → **Library**
2. Найди **Google Sheets API**
3. Нажми **Enable**

#### Шаг 5: Дай доступ к таблице
1. Открой скачанный JSON файл
2. Скопируй значение `client_email` (например: `mts-iaas-service@project.iam.gserviceaccount.com`)
3. Открой свою Google таблицу
4. Нажми **Share** (Поделиться)
5. Вставь email из `client_email`
6. Дай права **Editor** (Редактор)
7. Нажми **Send**

#### Шаг 6: Настрой `.env` файл
1. Скопируй `backend/env.example` в `backend/.env`
2. Открой `backend/.env`
3. Заполни:
   ```env
   GOOGLE_SHEETS_ID=твой_id_таблицы_из_url
   GOOGLE_SERVICE_ACCOUNT_EMAIL=email_из_json_файла
   GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nключ_из_json_файла\n-----END RSA PRIVATE KEY-----"
   ```
   ⚠️ **Важно**: В `GOOGLE_PRIVATE_KEY` замени `\n` на реальные переносы строк или оставь как есть (Node.js обработает)

### 3. Инициализация базы данных (seed)

```powershell
cd backend
node src/scripts/seed.js
```

Это создаст:
- ✅ Админа: `admin@mts.ru` / `admin123`
- ✅ Демо-тенант "Tenant Alpha"
- ✅ Клиента: `client@alpha.ru` / `client123`
- ✅ Org VDC с ресурсами
- ✅ Демо-ВМ

### 4. Запуск серверов

#### Вариант 1: Автоматический запуск (рекомендуется)
```powershell
.\start-dev.ps1
```

#### Вариант 2: Вручную в двух терминалах

**Терминал 1 (Backend):**
```powershell
cd backend
npm run dev
```
→ Backend запустится на http://localhost:3001

**Терминал 2 (Frontend):**
```powershell
cd frontend
npm run dev
```
→ Frontend запустится на http://localhost:5173

### 5. Открой в браузере

🌐 **Frontend**: http://localhost:5173  
🔧 **Backend API**: http://localhost:3001/api/health

---

## 📋 Учетные данные (после seed)

| Роль | Email | Пароль |
|------|-------|--------|
| **Admin** | `admin@mts.ru` | `admin123` |
| **Client** | `client@alpha.ru` | `client123` |

---

## 🛠️ Структура проекта

```
backend/          → Node.js + Express API
frontend/         → React + TypeScript + Vite
backend/.env      → Конфигурация (создай из env.example)
```

---

## ⚠️ Troubleshooting

### Ошибка: "Could not initialize Google Sheets"
- Проверь, что `.env` файл заполнен правильно
- Убедись, что Service Account имеет доступ к таблице
- Проверь, что Google Sheets API включен

### Ошибка: "CORS error"
- Убедись, что `FRONTEND_URL` в `.env` = `http://localhost:5173`
- Перезапусти backend

### Порт занят
- Измени `PORT` в `backend/.env` (например, на `3002`)
- Или измени `port` в `frontend/vite.config.ts`

---

## 📚 API Endpoints

- `POST /api/auth/login` - Вход
- `GET /api/stats` - Статистика
- `GET /api/vms` - Список ВМ
- `GET /api/tenants` - Список тенантов (admin)
- И т.д.

Полный список смотри в `backend/src/routes/`
