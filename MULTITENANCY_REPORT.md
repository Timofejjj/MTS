# 📋 ОТЧЕТ: Реализация мультитенантности в MTS IaaS Platform

**Дата:** 2025-03-04  
**Версия:** 1.0  
**Автор:** Product Manager Report

---

## 🎯 КРАТКОЕ РЕЗЮМЕ

Мультитенантность реализована через **логическую изоляцию данных** на уровне приложения:
- Каждый пользователь имеет `tenant_id` в JWT токене
- Все запросы фильтруются по `tenant_id` пользователя
- Администраторы обходят фильтры и видят все данные
- Изоляция работает на уровне API, базы данных и фронтенда

---

## 📐 АРХИТЕКТУРА МУЛЬТИТЕНАНТНОСТИ

### Уровень 1: Хранение tenant_id

**Где хранится:**
1. В таблице `users` (Google Sheets) — поле `tenant_id`
2. В JWT токене — после логина `tenant_id` вшивается в токен
3. В localStorage браузера — сохраняется объект `user` с `tenant_id`

**Схема данных:**

```
┌─────────────────────────────────────────┐
│  Таблица: users                         │
├─────────────────────────────────────────┤
│  id          │ email          │ tenant_id │
│  uuid-1      │ admin@mts.ru   │ (пусто)   │ ← Admin
│  uuid-2      │ client@alpha.ru │ uuid-tenant-alpha │ ← Client
│  uuid-3      │ user@beta.ru   │ uuid-tenant-beta  │ ← Client
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Таблица: tenants                       │
├─────────────────────────────────────────┤
│  id                    │ name          │
│  uuid-tenant-alpha     │ Tenant Alpha  │
│  uuid-tenant-beta      │ Tenant Beta   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Таблица: vms                           │
├─────────────────────────────────────────┤
│  id      │ tenant_id          │ name    │
│  vm-1    │ uuid-tenant-alpha  │ web-01  │
│  vm-2    │ uuid-tenant-alpha  │ db-01   │
│  vm-3    │ uuid-tenant-beta   │ api-01  │
└─────────────────────────────────────────┘
```

---

## 🔐 УРОВЕНЬ 2: Аутентификация и JWT токен

### Код: backend/src/routes/auth.js

```javascript
// При логине создаётся JWT токен с tenant_id
router.post('/login', async (req, res) => {
  const user = await db.findOne(SHEETS.USERS, (u) => u.email === email);
  
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,           // ← 'admin' или 'client'
      tenant_id: user.tenant_id, // ← КЛЮЧЕВОЕ ПОЛЕ для изоляции
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user });
});
```

**Пример JWT токена (декодированный):**
```json
{
  "id": "c92f887d-28d6-4d8c-bd5a-3cba64f65e27",
  "email": "client@alpha.ru",
  "role": "client",
  "tenant_id": "c7b74efa-9215-434c-bf34-76cd03aa7eec",  ← Tenant Alpha
  "name": "Client Alpha",
  "iat": 1772627163,
  "exp": 1772713563
}
```

**Важно:** Каждый HTTP запрос содержит этот токен в заголовке:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🛡️ УРОВЕНЬ 3: Middleware — проверка доступа

### Код: backend/src/middleware/auth.js

```javascript
// 1. Извлечение пользователя из JWT токена
function authMiddleware(req, res, next) {
  const token = req.headers.authorization.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;  // ← Теперь req.user содержит tenant_id
  next();
}

// 2. Проверка прав администратора
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

// 3. Проверка доступа к тенанту
function tenantAccess(req, res, next) {
  const tenantId = req.params.tenantId || req.body.tenant_id;

  // Админы обходят проверку
  if (req.user?.role === 'admin') {
    return next();
  }

  // Клиенты могут работать только со своим тенантом
  if (req.user?.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Forbidden: Access to this tenant is not allowed' });
  }

  next();
}
```

**Логика:**
- ✅ Admin → видит всё (bypass всех проверок)
- ✅ Client → видит только свой `tenant_id`
- ❌ Client пытается получить чужой тенант → 403 Forbidden

---

## 📊 УРОВЕНЬ 4: Фильтрация данных в API

### Пример 1: GET /api/vms — список виртуальных машин

**Код: backend/src/routes/vms.js**

```javascript
router.get('/', authMiddleware, async (req, res) => {
  try {
    let vms;
    
    // ВАРИАНТ A: Администратор видит ВСЕ ВМ
    if (req.user.role === 'admin') {
      vms = await db.getAll(SHEETS.VMS);
    } 
    // ВАРИАНТ B: Клиент видит только свои ВМ
    else {
      vms = await db.findWhere(SHEETS.VMS, (v) => v.tenant_id === req.user.tenant_id);
    }
    
    res.json(vms);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Как это работает:**

```
Запрос: GET /api/vms
Headers: Authorization: Bearer <JWT>

Backend:
  1. authMiddleware извлекает из JWT:
     {
       role: "client",
       tenant_id: "c7b74efa-9215-434c-bf34-76cd03aa7eec"
     }
  
  2. Проверяет роль:
     - Если "admin" → db.getAll() → возвращает ВСЕ ВМ
     - Если "client" → db.findWhere(tenant_id === "c7b74efa...") → только ВМ этого тенанта

Результат для Client:
  [
    { id: "vm-1", tenant_id: "c7b74efa...", name: "web-01" },  ← видит
    { id: "vm-2", tenant_id: "c7b74efa...", name: "db-01" },   ← видит
    // vm-3 с tenant_id "uuid-tenant-beta" НЕ попадает в результат
  ]
```

---

### Пример 2: GET /api/vms/:id — получение конкретной ВМ

**Код: backend/src/routes/vms.js**

```javascript
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const vm = await db.findById(SHEETS.VMS, req.params.id);
    if (!vm) return res.status(404).json({ error: 'VM not found' });

    // КРИТИЧЕСКАЯ ПРОВЕРКА: принадлежит ли VM тенанту пользователя?
    if (req.user.role !== 'admin' && vm.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(vm);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Сценарий атаки (защищён):**

```
Клиент Tenant Alpha пытается получить VM Tenant Beta:

Запрос: GET /api/vms/vm-3
Headers: Authorization: Bearer <JWT_ALPHA>
JWT содержит: tenant_id = "uuid-tenant-alpha"

Backend:
  1. Находит VM: { id: "vm-3", tenant_id: "uuid-tenant-beta", ... }
  2. Проверяет: "uuid-tenant-alpha" !== "uuid-tenant-beta"
  3. Возвращает: 403 Forbidden ❌

Результат: Клиент НЕ может получить доступ к чужим ВМ
```

---

### Пример 3: POST /api/vms — создание новой ВМ

**Код: backend/src/routes/vms.js**

```javascript
router.post('/', authMiddleware, async (req, res) => {
  const { name, org_vdc_id, cpu, ram, disk, os } = req.body;

  // 1. Получаем OrgVDC
  const vdc = await db.findById(SHEETS.ORG_VDCS, org_vdc_id);
  if (!vdc) return res.status(404).json({ error: 'OrgVDC not found' });

  // 2. КРИТИЧЕСКАЯ ПРОВЕРКА: принадлежит ли VDC тенанту пользователя?
  if (req.user.role !== 'admin' && vdc.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ 
      error: 'Forbidden: OrgVDC belongs to different tenant' 
    });
  }

  // 3. Создаём VM с tenant_id из VDC (не из запроса!)
  const newVm = {
    id: uuidv4(),
    tenant_id: vdc.tenant_id,  // ← Безопасно: берём из VDC, а не из req.body
    org_vdc_id,
    name,
    status: 'running',
    // ...
  };

  await db.insert(SHEETS.VMS, newVm);
  res.status(201).json(newVm);
});
```

**Защита от подмены tenant_id:**

```
Попытка атаки: Клиент Tenant Alpha пытается создать VM в VDC Tenant Beta

Запрос: POST /api/vms
Body: {
  "org_vdc_id": "vdc-beta-id",  ← VDC принадлежит Tenant Beta
  "name": "hacked-vm",
  ...
}
Headers: Authorization: Bearer <JWT_ALPHA>
JWT содержит: tenant_id = "uuid-tenant-alpha"

Backend:
  1. Находит VDC: { id: "vdc-beta-id", tenant_id: "uuid-tenant-beta" }
  2. Проверяет: "uuid-tenant-alpha" !== "uuid-tenant-beta"
  3. Возвращает: 403 Forbidden ❌

Результат: Клиент НЕ может создать ВМ в чужом VDC
```

**Важно:** `tenant_id` для новой VM берётся из VDC, а не из запроса клиента!

---

### Пример 4: GET /api/tenants — список тенантов

**Код: backend/src/routes/tenants.js**

```javascript
router.get('/', authMiddleware, async (req, res) => {
  try {
    // ВАРИАНТ A: Администратор видит ВСЕХ тенантов
    if (req.user.role === 'admin') {
      const tenants = await db.getAll(SHEETS.TENANTS);
      return res.json(tenants);
    }

    // ВАРИАНТ B: Клиент видит только СВОЙ тенант
    if (!req.user.tenant_id) {
      return res.json(null);  // У клиента нет тенанта
    }
    const tenant = await db.findById(SHEETS.TENANTS, req.user.tenant_id);
    return res.json(tenant);  // Возвращаем ОДИН объект, не массив
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Разница в ответах:**

```
Admin запрос: GET /api/tenants
Ответ: [
  { id: "uuid-alpha", name: "Tenant Alpha" },
  { id: "uuid-beta",  name: "Tenant Beta" },
  { id: "uuid-gamma", name: "Tenant Gamma" }
]

Client запрос: GET /api/tenants
Ответ: {
  id: "uuid-alpha",
  name: "Tenant Alpha"  ← только свой тенант
}
```

---

### Пример 5: GET /api/org-vdcs — список VDC

**Код: backend/src/routes/orgVdcs.js**

```javascript
router.get('/', authMiddleware, async (req, res) => {
  try {
    let vdcs;
    
    if (req.user.role === 'admin') {
      // Админ видит все VDC
      vdcs = await db.getAll(SHEETS.ORG_VDCS);
    } else {
      // Клиент видит только VDC своего тенанта
      vdcs = await db.findWhere(
        SHEETS.ORG_VDCS, 
        (v) => v.tenant_id === req.user.tenant_id
      );
    }
    
    res.json(vdcs);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## 🎨 УРОВЕНЬ 5: Изоляция на фронтенде

### Код: frontend/src/contexts/AuthContext.tsx

```typescript
// После логина сохраняется user с tenant_id
const login = async (email: string, password: string) => {
  const res = await authApi.login(email, password);
  const { token, user } = res.data;
  
  // user содержит: { id, email, role, tenant_id, name }
  localStorage.setItem('user', JSON.stringify(user));
  setUser(user);  // ← Теперь user.tenant_id доступен во всём приложении
};
```

### Код: frontend/src/pages/VMsPage.tsx

```typescript
export default function VMsPage() {
  const { isAdmin, user } = useAuth();  // ← user.tenant_id доступен
  
  useEffect(() => {
    // API автоматически фильтрует по tenant_id
    vmsApi.getAll().then((res) => {
      // Client получает только свои ВМ
      // Admin получает все ВМ
      setVms(res.data);
    });
  }, []);
  
  // В UI показываем только то, что пришло с сервера
  return (
    <div>
      {vms.map(vm => (
        <VMRow key={vm.id} vm={vm} />
      ))}
    </div>
  );
}
```

**Важно:** Фронтенд НЕ фильтрует данные — это делает backend. Фронтенд просто показывает то, что пришло.

---

## 🔒 УРОВЕНЬ 6: Защита WebSocket терминала

### Код: backend/src/index.js

```javascript
wss.on('connection', async (ws, req) => {
  const query = url.parse(req.url, true).query;
  const token = query.token;  // JWT токен из query параметра
  const vmId  = query.vmId;   // ID виртуальной машины

  // 1. Проверяем JWT токен
  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    ws.send(JSON.stringify({ 
      type: 'output', 
      data: '\x1b[31mAuthentication failed.\x1b[0m\r\n' 
    }));
    ws.close();
    return;
  }

  // 2. Получаем VM из базы
  const vm = await db.findById(SHEETS.VMS, vmId);
  if (!vm) {
    ws.send(JSON.stringify({ 
      type: 'output', 
      data: '\x1b[31mVM not found.\x1b[0m\r\n' 
    }));
    ws.close();
    return;
  }

  // 3. КРИТИЧЕСКАЯ ПРОВЕРКА: принадлежит ли VM тенанту пользователя?
  if (user.role !== 'admin' && vm.tenant_id !== user.tenant_id) {
    ws.send(JSON.stringify({ 
      type: 'output', 
      data: '\x1b[31mAccess denied.\x1b[0m\r\n' 
    }));
    ws.close();
    return;
  }

  // 4. Только после всех проверок создаём shell сессию
  const shell = new MockShell(vm, user);
  // ... остальной код терминала
});
```

**Сценарий защиты:**

```
Клиент Tenant Alpha пытается подключиться к терминалу VM Tenant Beta:

WebSocket: ws://localhost:3001/terminal?vmId=vm-3&token=<JWT_ALPHA>
JWT содержит: tenant_id = "uuid-tenant-alpha"

Backend:
  1. Проверяет JWT → OK
  2. Находит VM: { id: "vm-3", tenant_id: "uuid-tenant-beta" }
  3. Проверяет: "uuid-tenant-alpha" !== "uuid-tenant-beta"
  4. Закрывает соединение с сообщением "Access denied" ❌

Результат: Клиент НЕ может подключиться к терминалу чужой VM
```

---

## 📈 СХЕМА ПОТОКА ДАННЫХ

### Сценарий: Клиент запрашивает список своих ВМ

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       │ 1. GET /api/vms
       │    Headers: Authorization: Bearer <JWT>
       │    JWT содержит: { role: "client", tenant_id: "uuid-alpha" }
       │
       ▼
┌─────────────────────────────────────┐
│         Backend API                  │
│  ─────────────────────────────────  │
│  1. authMiddleware:                 │
│     - Извлекает JWT                 │
│     - Декодирует токен              │
│     - Устанавливает req.user = {    │
│         role: "client",             │
│         tenant_id: "uuid-alpha"    │
│       }                             │
│                                     │
│  2. Проверка роли:                  │
│     if (req.user.role === 'admin') │
│       → db.getAll()                 │
│     else                            │
│       → db.findWhere(               │
│           tenant_id === "uuid-alpha"│
│         )                           │
└─────────────┬───────────────────────┘
              │
              │ 2. SQL-подобный запрос к Google Sheets
              │    SELECT * FROM vms WHERE tenant_id = "uuid-alpha"
              │
              ▼
┌─────────────────────────────────────┐
│      Google Sheets (Database)       │
│  ─────────────────────────────────  │
│  Таблица: vms                       │
│  ├─ vm-1 │ tenant_id: "uuid-alpha" │ ← попадает
│  ├─ vm-2 │ tenant_id: "uuid-alpha" │ ← попадает
│  └─ vm-3 │ tenant_id: "uuid-beta"  │ ← НЕ попадает
└─────────────┬───────────────────────┘
              │
              │ 3. Возвращает отфильтрованные данные
              │    [{ vm-1 }, { vm-2 }]
              │
              ▼
┌─────────────────────────────────────┐
│         Backend API                 │
│  ─────────────────────────────────  │
│  4. res.json([{ vm-1 }, { vm-2 }]) │
└─────────────┬───────────────────────┘
              │
              │ 4. HTTP 200 OK
              │    Body: [{ vm-1 }, { vm-2 }]
              │
              ▼
┌─────────────┐
│   Browser   │
│  (Frontend) │
│  ─────────────────────────────────  │
│  5. Отображает только свои ВМ      │
│     - vm-1                          │
│     - vm-2                          │
│     (vm-3 не виден)                 │
└─────────────┘
```

---

## 🎯 КЛЮЧЕВЫЕ ПРИНЦИПЫ ИЗОЛЯЦИИ

### Принцип 1: "Trust but Verify"
```
❌ НЕДОПУСТИМО: Доверять tenant_id из запроса клиента
✅ ПРАВИЛЬНО:   Брать tenant_id из проверенных источников:
   - Из JWT токена (проверен подписью)
   - Из связанных ресурсов (VDC → tenant_id)
   - Из базы данных (VM → tenant_id)
```

### Принцип 2: "Default Deny"
```
❌ НЕДОПУСТИМО: Разрешать доступ по умолчанию
✅ ПРАВИЛЬНО:   Запрещать доступ по умолчанию, разрешать только явно:
   if (user.role !== 'admin' && vm.tenant_id !== user.tenant_id) {
     return 403 Forbidden;  ← Запрет по умолчанию
   }
```

### Принцип 3: "Admin Bypass"
```
✅ Администраторы обходят все проверки tenant_id:
   if (req.user.role === 'admin') {
     return next();  // Пропускаем проверку
   }
   
   // Проверка только для клиентов
   if (vm.tenant_id !== req.user.tenant_id) {
     return 403;
   }
```

### Принцип 4: "Filter at Source"
```
❌ НЕДОПУСТИМО: Получить все данные, потом фильтровать на фронтенде
✅ ПРАВИЛЬНО:   Фильтровать на уровне базы данных:
   db.findWhere(SHEETS.VMS, (v) => v.tenant_id === user.tenant_id)
   
   Это:
   - Безопаснее (клиент не видит чужие данные)
   - Быстрее (меньше данных передаётся)
   - Масштабируемее (работает с миллионами записей)
```

---

## 📊 ТАБЛИЦА: Где применяется изоляция

| Endpoint | Метод | Admin видит | Client видит | Проверка |
|----------|-------|-------------|--------------|----------|
| `/api/vms` | GET | Все ВМ | Только свои ВМ | `tenant_id === user.tenant_id` |
| `/api/vms/:id` | GET | Любую ВМ | Только свою ВМ | `vm.tenant_id === user.tenant_id` |
| `/api/vms` | POST | Может создать в любом VDC | Только в своём VDC | `vdc.tenant_id === user.tenant_id` |
| `/api/vms/:id` | DELETE | Может удалить любую | Только свою | `vm.tenant_id === user.tenant_id` |
| `/api/tenants` | GET | Всех тенантов | Только свой тенант | `tenant.id === user.tenant_id` |
| `/api/org-vdcs` | GET | Все VDC | Только свои VDC | `vdc.tenant_id === user.tenant_id` |
| `/api/org-vdcs` | POST | Может создать для любого тенанта | ❌ Запрещено | `adminOnly` middleware |
| `/api/stats` | GET | Статистика всей платформы | Статистика своего тенанта | Фильтрация по `tenant_id` |
| `/api/audit` | GET | Все логи | Логи своего тенанта | `log.tenant_id === user.tenant_id` |
| `/terminal` | WebSocket | Может подключиться к любой VM | Только к своей VM | `vm.tenant_id === user.tenant_id` |

---

## 🔍 ДЕТАЛЬНЫЙ РАЗБОР: Создание VM с проверкой изоляции

### Полный код: backend/src/routes/vms.js (POST /api/vms)

```javascript
router.post('/', authMiddleware, async (req, res) => {
  const { name, org_vdc_id, cpu, ram, disk, os } = req.body;

  // ── ШАГ 1: Получаем VDC из базы ─────────────────────────────────────────
  const vdc = await db.findById(SHEETS.ORG_VDCS, org_vdc_id);
  if (!vdc) return res.status(404).json({ error: 'OrgVDC not found' });

  // ── ШАГ 2: ПРОВЕРКА ИЗОЛЯЦИИ ────────────────────────────────────────────
  // Клиент может создать VM только в VDC своего тенанта
  if (req.user.role !== 'admin' && vdc.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ 
      error: 'Forbidden: OrgVDC belongs to different tenant' 
    });
  }
  // ✅ Если проверка прошла, продолжаем

  // ── ШАГ 3: Проверка ресурсов ────────────────────────────────────────────
  const cpuUsed  = parseInt(vdc.cpu_used || '0');
  const cpuLimit = parseInt(vdc.cpu_limit);
  if (cpuUsed + parseInt(cpu) > cpuLimit) {
    return res.status(400).json({
      error: `Not enough CPU. Available: ${cpuLimit - cpuUsed} vCPU`
    });
  }
  // Аналогично для RAM и Disk...

  // ── ШАГ 4: Создание VM с БЕЗОПАСНЫМ tenant_id ────────────────────────────
  const newVm = {
    id: uuidv4(),
    tenant_id: vdc.tenant_id,  // ← БЕЗОПАСНО: берём из VDC, НЕ из req.body!
    org_vdc_id,
    name,
    status: 'running',
    cpu: String(cpu),
    ram: String(ram),
    disk: String(disk),
    ip: generateIP(),
    os,
    created_at: new Date().toISOString(),
    owner_id: req.user.id,
  };

  await db.insert(SHEETS.VMS, newVm);

  // ── ШАГ 5: Обновление использованных ресурсов ───────────────────────────
  await db.updateById(SHEETS.ORG_VDCS, org_vdc_id, {
    cpu_used:  String(cpuUsed + parseInt(cpu)),
    ram_used:  String(ramUsed + parseInt(ram)),
    disk_used: String(diskUsed + parseInt(disk)),
  });

  res.status(201).json(newVm);
});
```

**Почему это безопасно:**

1. ✅ `tenant_id` берётся из VDC (проверенного ресурса), а не из запроса
2. ✅ Проверка доступа к VDC происходит ДО создания VM
3. ✅ Даже если клиент подменит `org_vdc_id`, проверка на шаге 2 отклонит запрос

---

## 🧪 ТЕСТОВЫЕ СЦЕНАРИИ

### Сценарий 1: Клиент получает список своих ВМ

**Данные в БД:**
```
vms:
  - vm-1: tenant_id = "uuid-alpha", name = "web-01"
  - vm-2: tenant_id = "uuid-alpha", name = "db-01"
  - vm-3: tenant_id = "uuid-beta",  name = "api-01"
```

**Запрос:**
```
GET /api/vms
Headers: Authorization: Bearer <JWT_CLIENT_ALPHA>
JWT содержит: tenant_id = "uuid-alpha"
```

**Ожидаемый результат:**
```json
[
  { "id": "vm-1", "tenant_id": "uuid-alpha", "name": "web-01" },
  { "id": "vm-2", "tenant_id": "uuid-alpha", "name": "db-01" }
]
```
✅ vm-3 НЕ попадает в результат

---

### Сценарий 2: Клиент пытается получить чужую VM

**Запрос:**
```
GET /api/vms/vm-3
Headers: Authorization: Bearer <JWT_CLIENT_ALPHA>
JWT содержит: tenant_id = "uuid-alpha"
```

**VM в БД:**
```
vm-3: tenant_id = "uuid-beta"
```

**Ожидаемый результат:**
```
HTTP 403 Forbidden
{ "error": "Forbidden" }
```
✅ Доступ запрещён

---

### Сценарий 3: Клиент пытается создать VM в чужом VDC

**Запрос:**
```
POST /api/vms
Body: {
  "org_vdc_id": "vdc-beta-id",
  "name": "hacked-vm",
  "cpu": 2,
  "ram": 4,
  "disk": 50,
  "os": "Ubuntu 22.04"
}
Headers: Authorization: Bearer <JWT_CLIENT_ALPHA>
JWT содержит: tenant_id = "uuid-alpha"
```

**VDC в БД:**
```
vdc-beta-id: tenant_id = "uuid-beta"
```

**Ожидаемый результат:**
```
HTTP 403 Forbidden
{ "error": "Forbidden: OrgVDC belongs to different tenant" }
```
✅ Создание запрещено

---

### Сценарий 4: Администратор видит всё

**Запрос:**
```
GET /api/vms
Headers: Authorization: Bearer <JWT_ADMIN>
JWT содержит: role = "admin", tenant_id = null
```

**Ожидаемый результат:**
```json
[
  { "id": "vm-1", "tenant_id": "uuid-alpha", "name": "web-01" },
  { "id": "vm-2", "tenant_id": "uuid-alpha", "name": "db-01" },
  { "id": "vm-3", "tenant_id": "uuid-beta",  "name": "api-01" }
]
```
✅ Админ видит все ВМ всех тенантов

---

## 🎓 ВЫВОДЫ ДЛЯ ПРОДАКТ-МЕНЕДЖЕРА

### ✅ Что реализовано:

1. **Логическая изоляция данных**
   - Каждый клиент видит только свои ресурсы
   - Данные фильтруются на уровне API
   - Изоляция работает автоматически для всех операций

2. **Безопасность**
   - Проверка доступа на каждом endpoint
   - Невозможно подменить `tenant_id` в запросе
   - Администраторы имеют полный доступ (для управления)

3. **Масштабируемость**
   - Фильтрация на уровне БД (быстро)
   - Работает с любым количеством тенантов
   - Не требует изменений при добавлении новых тенантов

4. **Удобство**
   - Клиент не думает об изоляции — она работает автоматически
   - Администратор видит всю платформу для управления

### ⚠️ Что НЕ реализовано (для будущего):

1. **Физическая изоляция**
   - Сейчас все тенанты на одном "физическом сервере" (симуляция)
   - В реальности можно добавить выделенные узлы для VIP-клиентов

2. **Сетевая изоляция**
   - Сейчас все ВМ в одной сети (10.x.x.x)
   - В реальности можно добавить VLAN для каждого тенанта

3. **Шифрование данных**
   - Сейчас данные хранятся в Google Sheets без шифрования
   - В реальности можно добавить encryption at rest

4. **Аудит доступа**
   - Сейчас логируются только действия (CREATE_VM, DELETE_VM)
   - В реальности можно добавить логирование всех попыток доступа

---

## 📝 КРАТКАЯ СПРАВКА ДЛЯ ПРЕЗЕНТАЦИИ

**Вопрос:** Как реализована мультитенантность?

**Ответ:**
1. Каждый пользователь имеет `tenant_id` в JWT токене
2. Все API запросы автоматически фильтруются по `tenant_id`
3. Клиенты видят только свои ресурсы
4. Администраторы видят всё для управления платформой
5. Проверка доступа происходит на каждом endpoint

**Код-пример:**
```javascript
// Клиент видит только свои ВМ
if (req.user.role === 'admin') {
  vms = await db.getAll(SHEETS.VMS);  // Все ВМ
} else {
  vms = await db.findWhere(SHEETS.VMS, 
    (v) => v.tenant_id === req.user.tenant_id  // Только свои
  );
}
```

---

**Конец отчёта**
