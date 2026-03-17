# Server Test Report

- Date: 2026-03-11
- Workspace: `/Users/sskaaat/DevProjects/cooperate/Backend`
- Runtime: `node v24.14.0`
- Method: isolated integration scenario via `createApp()` + temporary `DATA_FILE`, with state diff after every request.
- Separate checks already passed before this scenario: `npm test` (`2/2`) and real HTTP smoke test on `127.0.0.1:3101` (`GET /health -> 200`, `OPTIONS /api/company -> 204`).

## Final snapshot

- companies: 1
- users: 4
- ideas: 3
- votes: 5
- sessions: 3

## 1. Health check

- Request: `GET /health`
- Auth context: `anonymous`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "status": "ok"
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `onRequest` добавляет CORS-заголовки.
  - Маршрут `GET /health` не требует авторизации.
  - Хендлер возвращает статический объект `{ "status": "ok" }`, хранилище не читается и не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 0,
  "users": 0,
  "ideas": 0,
  "votes": 0,
  "sessions": 0
}
```

## 2. CORS preflight for protected route

- Request: `OPTIONS /api/company`
- Auth context: `anonymous`
- Status: `204`
- Request body: `none`
- Response body: `none`
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `onRequest` выставляет CORS-заголовки.
  - Так как метод `OPTIONS`, хук сразу отвечает `204 No Content`.
  - Маршрут, auth-проверки и сервисный слой не вызываются.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 0,
  "users": 0,
  "ideas": 0,
  "votes": 0,
  "sessions": 0
}
```

## 3. Protected route without token

- Request: `GET /api/company`
- Auth context: `anonymous`
- Status: `401`
- Request body: `none`
- Response body: 

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required",
    "details": null
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `onRequest` добавляет CORS-заголовки.
  - `requireAuth` пытается извлечь Bearer-токен из `Authorization`.
  - Токен отсутствует, поэтому выбрасывается `unauthorized()`.
  - Глобальный `setErrorHandler` сериализует ошибку в ответ `401`.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 0,
  "users": 0,
  "ideas": 0,
  "votes": 0,
  "sessions": 0
}
```

## 4. Company registration with director session

- Request: `POST /api/auth/register-company`
- Auth context: `anonymous`
- Status: `201`
- Request body: 

```json
{
  "companyName": "Acme Rocket",
  "companyDescription": "Internal platform for ideas and voting",
  "directorName": "Diana Director",
  "directorPosition": "Chief Executive Officer",
  "phone": "+7 (900) 000-0011",
  "password": "director123"
}
```
- Response body: 

```json
{
  "data": {
    "token": "<redacted:a86381>",
    "expiresAt": "2026-03-18T18:35:38.241Z",
    "company": {
      "id": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-11T18:35:38.241Z",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Diana Director",
      "phone": "+79000000011",
      "role": "director",
      "position": "Chief Executive Officer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.241Z"
    }
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - Fastify валидирует JSON body по route schema.
  - `service.registerCompany()` внутри `FileStore.update()` очищает просроченные сессии и нормализует входные поля.
  - Создаются записи компании, директора и первой сессии; затем файл состояния перезаписывается атомарно через `*.tmp` + `rename`.
- Persisted state delta:

```text
- companies:
  - added company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024: Acme Rocket
- users:
  - added user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28: Diana Director (director)
- sessions:
  - added session_cb653007-3a36-48d7-a58b-31b926d24a10: user=user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28, expiresAt=2026-03-18T18:35:38.241Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 1,
  "ideas": 0,
  "votes": 0,
  "sessions": 1
}
```

## 5. Current profile for director

- Request: `GET /api/auth/me`
- Auth context: `director`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "user": {
      "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Diana Director",
      "phone": "+79000000011",
      "role": "director",
      "position": "Chief Executive Officer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.241Z"
    },
    "company": {
      "id": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-11T18:35:38.241Z",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "stats": {
      "employees": 1,
      "ideas": {
        "total": 0,
        "active": 0,
        "archive": 0,
        "pendingModeration": 0,
        "waitingForDirector": 0
      }
    }
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` читает токен, ищет активную сессию и наполняет `request.currentUser/currentCompany`.
  - Хендлер вызывает `service.getCompanyOverview()` для сборки статистики компании.
  - Возвращается объединённый payload: текущий пользователь, компания и счётчики, без изменения состояния файла.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 1,
  "ideas": 0,
  "votes": 0,
  "sessions": 1
}
```

## 6. Create admin account

- Request: `POST /api/employees`
- Auth context: `director`
- Status: `201`
- Request body: 

```json
{
  "fullName": "Alice Admin",
  "phone": "+7 (900) 000-0012",
  "password": "admin123",
  "role": "admin",
  "position": "Operations Admin"
}
```
- Response body: 

```json
{
  "data": {
    "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "fullName": "Alice Admin",
    "phone": "+79000000012",
    "role": "admin",
    "position": "Operations Admin",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-11T18:35:38.299Z"
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(director)` пропускает только директора.
  - `service.addEmployee()` в `FileStore.update()` нормализует телефон, валидирует роль (`admin|employee`) и проверяет уникальность телефона по всем пользователям.
  - В `state.users` добавляется новый активный пользователь компании; сессии и идеи не изменяются.
- Persisted state delta:

```text
- users:
  - added user_c938f85d-9f07-481a-b8ae-5a37108ddfc2: Alice Admin (admin)
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 2,
  "ideas": 0,
  "votes": 0,
  "sessions": 1
}
```

## 7. Create employee account #1

- Request: `POST /api/employees`
- Auth context: `director`
- Status: `201`
- Request body: 

```json
{
  "fullName": "Egor Employee",
  "phone": "+7 (900) 000-0013",
  "password": "employee123",
  "role": "employee",
  "position": "Developer"
}
```
- Response body: 

```json
{
  "data": {
    "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "fullName": "Egor Employee",
    "phone": "+79000000013",
    "role": "employee",
    "position": "Developer",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-11T18:35:38.327Z"
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(director)` пропускает только директора.
  - `service.addEmployee()` в `FileStore.update()` нормализует телефон, валидирует роль (`admin|employee`) и проверяет уникальность телефона по всем пользователям.
  - В `state.users` добавляется новый активный пользователь компании; сессии и идеи не изменяются.
- Persisted state delta:

```text
- users:
  - added user_4617da35-7fb8-4490-9394-67b62861b60f: Egor Employee (employee)
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 3,
  "ideas": 0,
  "votes": 0,
  "sessions": 1
}
```

## 8. Create employee account #2

- Request: `POST /api/employees`
- Auth context: `director`
- Status: `201`
- Request body: 

```json
{
  "fullName": "Mila Employee",
  "phone": "+7 (900) 000-0014",
  "password": "employee123",
  "role": "employee",
  "position": "Designer"
}
```
- Response body: 

```json
{
  "data": {
    "id": "user_a3c9d038-253a-4ba7-a171-891d4fce6199",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "fullName": "Mila Employee",
    "phone": "+79000000014",
    "role": "employee",
    "position": "Designer",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-11T18:35:38.355Z"
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(director)` пропускает только директора.
  - `service.addEmployee()` в `FileStore.update()` нормализует телефон, валидирует роль (`admin|employee`) и проверяет уникальность телефона по всем пользователям.
  - В `state.users` добавляется новый активный пользователь компании; сессии и идеи не изменяются.
- Persisted state delta:

```text
- users:
  - added user_a3c9d038-253a-4ba7-a171-891d4fce6199: Mila Employee (employee)
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 0,
  "votes": 0,
  "sessions": 1
}
```

## 9. Admin login

- Request: `POST /api/auth/login`
- Auth context: `anonymous`
- Status: `200`
- Request body: 

```json
{
  "phone": "+79000000012",
  "password": "admin123"
}
```
- Response body: 

```json
{
  "data": {
    "token": "<redacted:0610fc>",
    "expiresAt": "2026-03-18T18:35:38.382Z",
    "company": {
      "id": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-11T18:35:38.241Z",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Alice Admin",
      "phone": "+79000000012",
      "role": "admin",
      "position": "Operations Admin",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.299Z"
    }
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - Fastify валидирует логин-пейлоад.
  - `service.login()` находит активного пользователя по нормализованному телефону, сверяет пароль через `scrypt` и создаёт новую сессию.
  - Изменяется только коллекция `sessions`; пользователи и компания не переписываются.
- Persisted state delta:

```text
- sessions:
  - added session_3a9e5539-8550-438a-8579-6db12f344f24: user=user_c938f85d-9f07-481a-b8ae-5a37108ddfc2, expiresAt=2026-03-18T18:35:38.382Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 0,
  "votes": 0,
  "sessions": 2
}
```

## 10. Employee #1 login

- Request: `POST /api/auth/login`
- Auth context: `anonymous`
- Status: `200`
- Request body: 

```json
{
  "phone": "+79000000013",
  "password": "employee123"
}
```
- Response body: 

```json
{
  "data": {
    "token": "<redacted:93a932>",
    "expiresAt": "2026-03-18T18:35:38.411Z",
    "company": {
      "id": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-11T18:35:38.241Z",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    }
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - Fastify валидирует логин-пейлоад.
  - `service.login()` находит активного пользователя по нормализованному телефону, сверяет пароль через `scrypt` и создаёт новую сессию.
  - Изменяется только коллекция `sessions`; пользователи и компания не переписываются.
- Persisted state delta:

```text
- sessions:
  - added session_f6eaf070-fd63-431b-aac5-bd606f7df17f: user=user_4617da35-7fb8-4490-9394-67b62861b60f, expiresAt=2026-03-18T18:35:38.411Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 0,
  "votes": 0,
  "sessions": 3
}
```

## 11. Employee #2 login

- Request: `POST /api/auth/login`
- Auth context: `anonymous`
- Status: `200`
- Request body: 

```json
{
  "phone": "+79000000014",
  "password": "employee123"
}
```
- Response body: 

```json
{
  "data": {
    "token": "<redacted:17c3d4>",
    "expiresAt": "2026-03-18T18:35:38.438Z",
    "company": {
      "id": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-11T18:35:38.241Z",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_a3c9d038-253a-4ba7-a171-891d4fce6199",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Mila Employee",
      "phone": "+79000000014",
      "role": "employee",
      "position": "Designer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.355Z"
    }
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - Fastify валидирует логин-пейлоад.
  - `service.login()` находит активного пользователя по нормализованному телефону, сверяет пароль через `scrypt` и создаёт новую сессию.
  - Изменяется только коллекция `sessions`; пользователи и компания не переписываются.
- Persisted state delta:

```text
- sessions:
  - added session_03665203-5c44-46cd-b7c7-22536e1bed67: user=user_a3c9d038-253a-4ba7-a171-891d4fce6199, expiresAt=2026-03-18T18:35:38.438Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 0,
  "votes": 0,
  "sessions": 4
}
```

## 12. Employee directory for director

- Request: `GET /api/employees`
- Auth context: `director`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Diana Director",
        "phone": "+79000000011",
        "role": "director",
        "position": "Chief Executive Officer",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-11T18:35:38.241Z"
      },
      {
        "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-11T18:35:38.299Z"
      },
      {
        "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Egor Employee",
        "phone": "+79000...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` валидирует сессию.
  - `service.listEmployees()` фильтрует активных пользователей компании и сортирует их по ролям: director -> admin -> employee.
  - Ответ формируется только чтением из файла, без мутаций.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 0,
  "votes": 0,
  "sessions": 4
}
```

## 13. Employee attempts to create another user

- Request: `POST /api/employees`
- Auth context: `employee1`
- Status: `403`
- Request body: 

```json
{
  "fullName": "Blocked User",
  "phone": "+79000000020",
  "password": "blocked123",
  "role": "employee",
  "position": "Blocked"
}
```
- Response body: 

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This endpoint is only available for roles: director",
    "details": null
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(director)` сначала вызывает `requireAuth` и получает текущего пользователя.
  - После этого guard сравнивает роль с допустимым списком и останавливает запрос на уровне preHandler.
  - `service.addEmployee()` не вызывается, поэтому состояние хранилища не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 0,
  "votes": 0,
  "sessions": 4
}
```

## 14. Director attempts to submit an idea

- Request: `POST /api/ideas`
- Auth context: `director`
- Status: `403`
- Request body: 

```json
{
  "title": "Director idea",
  "description": "This must be forbidden by business rules."
}
```
- Response body: 

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "The director cannot create ideas",
    "details": null
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.createIdea()` сразу проверяет роль и запрещает директору создавать идеи.
  - Из-за ошибки `FORBIDDEN` хранилище не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 0,
  "votes": 0,
  "sessions": 4
}
```

## 15. Employee #1 creates idea A

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Status: `201`
- Request body: 

```json
{
  "title": "Idea A: Coffee machine",
  "description": "Install a coffee machine in the office kitchen."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "pending_moderation",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": null,
      "comment": null,
      "reviewedAt": null
    },
    "votes": {
      "support": 0,
      "against": 0,
      "total": 0,
      "eligibleVoters": 0,
      "remainingVotes": 0,
  ...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.createIdea()` валидирует роль, очищает title/description и считает идеи автора за текущий UTC-месяц.
  - В `state.ideas` добавляется новая запись со статусом `pending_moderation`; объект ответа уже собран через `buildIdeaPayload()`.
- Persisted state delta:

```text
- ideas:
  - added idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea: Idea A: Coffee machine [pending_moderation]
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 1,
  "votes": 0,
  "sessions": 4
}
```

## 16. Employee #1 creates idea B

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Status: `201`
- Request body: 

```json
{
  "title": "Idea B: New chairs",
  "description": "Replace chairs in the open space area."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_46c363bf-bdbe-4745-aea9-feeefbfa91f0",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea B: New chairs",
    "description": "Replace chairs in the open space area.",
    "descriptionPreview": "Replace chairs in the open space area.",
    "status": "pending_moderation",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": null,
      "comment": null,
      "reviewedAt": null
    },
    "votes": {
      "support": 0,
      "against": 0,
      "total": 0,
      "eligibleVoters": 0,
      "remainingVotes": 0,
      "approvalPercent":...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.createIdea()` валидирует роль, очищает title/description и считает идеи автора за текущий UTC-месяц.
  - В `state.ideas` добавляется новая запись со статусом `pending_moderation`; объект ответа уже собран через `buildIdeaPayload()`.
- Persisted state delta:

```text
- ideas:
  - added idea_46c363bf-bdbe-4745-aea9-feeefbfa91f0: Idea B: New chairs [pending_moderation]
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 2,
  "votes": 0,
  "sessions": 4
}
```

## 17. Employee #1 creates idea C

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Status: `201`
- Request body: 

```json
{
  "title": "Idea C: Office karaoke night",
  "description": "Host a karaoke night in the office after work."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "pending_moderation",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": null,
      "comment": null,
      "reviewedAt": null
    },
    "votes": {
      "support": 0,
      "against": 0,
      "total": 0,
      "eligibleVoters": 0,
      "remainingVotes": 0...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.createIdea()` валидирует роль, очищает title/description и считает идеи автора за текущий UTC-месяц.
  - В `state.ideas` добавляется новая запись со статусом `pending_moderation`; объект ответа уже собран через `buildIdeaPayload()`.
- Persisted state delta:

```text
- ideas:
  - added idea_986c4a5e-f73a-4265-a673-aab2bc042a50: Idea C: Office karaoke night [pending_moderation]
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 0,
  "sessions": 4
}
```

## 18. Employee #1 exceeds the monthly idea limit

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Status: `409`
- Request body: 

```json
{
  "title": "Idea D: Fourth one",
  "description": "This request should hit the monthly limit."
}
```
- Response body: 

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Monthly limit reached: only 3 ideas are allowed per user",
    "details": null
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.createIdea()` пересчитывает идеи автора за текущий UTC-месяц и сравнивает их с лимитом `IDEA_MONTHLY_LIMIT`.
  - При четвёртой попытке выбрасывается `CONFLICT`, новая запись идеи не создаётся.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 0,
  "sessions": 4
}
```

## 19. Employee #1 sees own ideas

- Request: `GET /api/ideas?scope=mine`
- Auth context: `employee1`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "title": "Idea C: Office karaoke night",
        "description": "Host a karaoke night in the office after work.",
        "descriptionPreview": "Host a karaoke night in the office after work.",
        "status": "pending_moderation",
        "scope": "active",
        "archived": false,
        "author": {
          "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
          "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-11T18:35:38.327Z"
        },
        "moderation": {
          "reviewedBy": null,
          "comment": null,
          "reviewedAt": null
        },
      ...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.listIdeas()` читает все идеи компании, затем фильтрует их по `scope` и сортирует по `updatedAt` или поддержке.
  - Каждый элемент ответа обогащается через `buildIdeaPayload()`: автор, модерация, статистика голосов, доступные действия; состояние файла не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 0,
  "sessions": 4
}
```

## 20. Admin approves idea A for voting

- Request: `POST /api/ideas/idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea/moderate`
- Auth context: `admin`
- Status: `200`
- Request body: 

```json
{
  "approved": true,
  "comment": "Clear request, start voting."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
    ...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(admin, director)` допускает только администратора или директора.
  - `service.moderateIdea()` находит идею в статусе `pending_moderation`, проставляет `moderatedBy`, `moderatedAt`, комментарий и `updatedAt`.
  - При одобрении статус меняется на `voting`, а `votingEligibleUserIds` фиксируется снимком всех активных не-director пользователей компании на момент старта голосования.
- Persisted state delta:

```text
- ideas:
  - updated idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea: Idea A: Coffee machine [voting]; status: pending_moderation -> voting; moderationComment: null -> Clear request, start voting.; moderatedAt: null -> 2026-03-11T18:35:38.487Z; moderatedBy: null -> user_c938f85d-9f07-481a-b8ae-5a37108ddfc2; votingEligibleUserIds: [] -> [user_c938f85d-9f07-481a-b8ae-5a37108ddfc2, user_4617da35-7fb8-4490-9394-67b62861b60f, user_a3c9d038-253a-4ba7-a171-891d4fce6199]; votingOpenedAt: null -> 2026-03-11T18:35:38.487Z; updatedAt: 2026-03-11T18:35:38.482Z -> 2026-03-11T18:35:38.487Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 0,
  "sessions": 4
}
```

## 21. Admin rejects idea B during moderation

- Request: `POST /api/ideas/idea_46c363bf-bdbe-4745-aea9-feeefbfa91f0/moderate`
- Auth context: `admin`
- Status: `200`
- Request body: 

```json
{
  "approved": false,
  "comment": "Budget is already allocated."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_46c363bf-bdbe-4745-aea9-feeefbfa91f0",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea B: New chairs",
    "description": "Replace chairs in the open space area.",
    "descriptionPreview": "Replace chairs in the open space area.",
    "status": "rejected_by_admin",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role":...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(admin, director)` допускает только администратора или директора.
  - `service.moderateIdea()` обновляет метаданные модерации и проверяет текущий статус идеи.
  - При отклонении идея сразу переводится в `rejected_by_admin`, получает `archivedAt`, а список допустимых голосующих очищается.
- Persisted state delta:

```text
- ideas:
  - updated idea_46c363bf-bdbe-4745-aea9-feeefbfa91f0: Idea B: New chairs [rejected_by_admin]; status: pending_moderation -> rejected_by_admin; moderationComment: null -> Budget is already allocated.; moderatedAt: null -> 2026-03-11T18:35:38.488Z; moderatedBy: null -> user_c938f85d-9f07-481a-b8ae-5a37108ddfc2; archivedAt: null -> 2026-03-11T18:35:38.488Z; updatedAt: 2026-03-11T18:35:38.483Z -> 2026-03-11T18:35:38.488Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 0,
  "sessions": 4
}
```

## 22. Director approves idea C for voting

- Request: `POST /api/ideas/idea_986c4a5e-f73a-4265-a673-aab2bc042a50/moderate`
- Auth context: `director`
- Status: `200`
- Request body: 

```json
{
  "approved": true,
  "comment": "Let the team vote."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Diana Director",
        "phone": "+79000000011...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(admin, director)` допускает только администратора или директора.
  - `service.moderateIdea()` находит идею в статусе `pending_moderation`, проставляет `moderatedBy`, `moderatedAt`, комментарий и `updatedAt`.
  - При одобрении статус меняется на `voting`, а `votingEligibleUserIds` фиксируется снимком всех активных не-director пользователей компании на момент старта голосования.
- Persisted state delta:

```text
- ideas:
  - updated idea_986c4a5e-f73a-4265-a673-aab2bc042a50: Idea C: Office karaoke night [voting]; status: pending_moderation -> voting; moderationComment: null -> Let the team vote.; moderatedAt: null -> 2026-03-11T18:35:38.489Z; moderatedBy: null -> user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28; votingEligibleUserIds: [] -> [user_c938f85d-9f07-481a-b8ae-5a37108ddfc2, user_4617da35-7fb8-4490-9394-67b62861b60f, user_a3c9d038-253a-4ba7-a171-891d4fce6199]; votingOpenedAt: null -> 2026-03-11T18:35:38.489Z; updatedAt: 2026-03-11T18:35:38.484Z -> 2026-03-11T18:35:38.489Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 0,
  "sessions": 4
}
```

## 23. Employee #1 sees active ideas

- Request: `GET /api/ideas?scope=active`
- Auth context: `employee1`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "title": "Idea C: Office karaoke night",
        "description": "Host a karaoke night in the office after work.",
        "descriptionPreview": "Host a karaoke night in the office after work.",
        "status": "voting",
        "scope": "active",
        "archived": false,
        "author": {
          "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
          "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-11T18:35:38.327Z"
        },
        "moderation": {
          "reviewedBy": {
            "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
            "companyId": "...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.listIdeas()` читает все идеи компании, затем фильтрует их по `scope` и сортирует по `updatedAt` или поддержке.
  - Каждый элемент ответа обогащается через `buildIdeaPayload()`: автор, модерация, статистика голосов, доступные действия; состояние файла не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 0,
  "sessions": 4
}
```

## 24. Employee #1 votes FOR idea A

- Request: `POST /api/ideas/idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea/vote`
- Auth context: `employee1`
- Status: `200`
- Request body: 

```json
{
  "value": "for"
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
    ...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.voteIdea()` проверяет, что идея сейчас в `voting`, пользователь входит в `votingEligibleUserIds`, и голоса от него ещё не было.
  - Новый объект голоса добавляется в `state.votes`; затем пересчитывается поддержка, и при пороге `> 50%` идея переводится в `director_review`.
- Persisted state delta:

```text
- ideas:
  - updated idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea: Idea A: Coffee machine [voting]; updatedAt: 2026-03-11T18:35:38.487Z -> 2026-03-11T18:35:38.490Z
- votes:
  - added vote_96ba33e5-c42c-42c3-8dc4-ac9279217c30: user_4617da35-7fb8-4490-9394-67b62861b60f -> idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea = for
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 1,
  "sessions": 4
}
```

## 25. Employee #1 tries to vote twice for idea A

- Request: `POST /api/ideas/idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea/vote`
- Auth context: `employee1`
- Status: `409`
- Request body: 

```json
{
  "value": "for"
}
```
- Response body: 

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "You have already voted for this idea",
    "details": null
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.voteIdea()` находит уже существующий голос пользователя в `state.votes` для этой идеи.
  - Выбрасывается `CONFLICT`, повторный голос не записывается и статус идеи не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 1,
  "sessions": 4
}
```

## 26. Admin votes FOR idea A

- Request: `POST /api/ideas/idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea/vote`
- Auth context: `admin`
- Status: `200`
- Request body: 

```json
{
  "value": "for"
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "director_review",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Alice Admin",
        "phone": "+790000000...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.voteIdea()` проверяет, что идея сейчас в `voting`, пользователь входит в `votingEligibleUserIds`, и голоса от него ещё не было.
  - Новый объект голоса добавляется в `state.votes`; затем пересчитывается поддержка, и при пороге `> 50%` идея переводится в `director_review`.
- Persisted state delta:

```text
- ideas:
  - updated idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea: Idea A: Coffee machine [director_review]; status: voting -> director_review; votingClosedAt: null -> 2026-03-11T18:35:38.491Z; directorReviewRequestedAt: null -> 2026-03-11T18:35:38.491Z; updatedAt: 2026-03-11T18:35:38.490Z -> 2026-03-11T18:35:38.491Z
- votes:
  - added vote_d2b1047a-c44b-41eb-a0b5-b721ba1926a3: user_c938f85d-9f07-481a-b8ae-5a37108ddfc2 -> idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea = for
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 2,
  "sessions": 4
}
```

## 27. Director sees ideas waiting for final decision

- Request: `GET /api/ideas?scope=director_review`
- Auth context: `director`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "title": "Idea A: Coffee machine",
        "description": "Install a coffee machine in the office kitchen.",
        "descriptionPreview": "Install a coffee machine in the office kitchen.",
        "status": "director_review",
        "scope": "active",
        "archived": false,
        "author": {
          "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
          "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-11T18:35:38.327Z"
        },
        "moderation": {
          "reviewedBy": {
            "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
            "companyI...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.listIdeas()` читает все идеи компании, затем фильтрует их по `scope` и сортирует по `updatedAt` или поддержке.
  - Каждый элемент ответа обогащается через `buildIdeaPayload()`: автор, модерация, статистика голосов, доступные действия; состояние файла не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 2,
  "sessions": 4
}
```

## 28. Director approves idea A

- Request: `POST /api/ideas/idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea/decision`
- Auth context: `director`
- Status: `200`
- Request body: 

```json
{
  "approved": true,
  "comment": "Approved for the next quarter."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "approved_by_director",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Alice Admin",
        "phone": "+7900...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireRoles(director)` сначала валидирует сессию и роль директора.
  - `service.makeDirectorDecision()` принимает только идеи в статусе `director_review`, выставляет `directorDecision*`, `archivedAt`, `updatedAt` и финальный статус.
  - Идея окончательно уходит в архив как `approved_by_director` или `rejected_by_director`.
- Persisted state delta:

```text
- ideas:
  - updated idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea: Idea A: Coffee machine [approved_by_director]; status: director_review -> approved_by_director; directorDecisionAt: null -> 2026-03-11T18:35:38.492Z; directorDecisionBy: null -> user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28; directorComment: null -> Approved for the next quarter.; archivedAt: null -> 2026-03-11T18:35:38.492Z; updatedAt: 2026-03-11T18:35:38.491Z -> 2026-03-11T18:35:38.492Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 2,
  "sessions": 4
}
```

## 29. Employee #1 votes AGAINST idea C

- Request: `POST /api/ideas/idea_986c4a5e-f73a-4265-a673-aab2bc042a50/vote`
- Auth context: `employee1`
- Status: `200`
- Request body: 

```json
{
  "value": "against"
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Diana Director",
        "phone": "+79000000011...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.voteIdea()` записывает голос `against` в `state.votes` после проверки статуса и права голоса.
  - После каждого голоса пересчитывается статистика; если проголосовали все допустимые пользователи и поддержка не превысила 50%, идея архивируется как `rejected_by_vote`.
- Persisted state delta:

```text
- ideas:
  - updated idea_986c4a5e-f73a-4265-a673-aab2bc042a50: Idea C: Office karaoke night [voting]; updatedAt: 2026-03-11T18:35:38.489Z -> 2026-03-11T18:35:38.493Z
- votes:
  - added vote_dff6d5fb-388c-4601-a793-d646f193afa2: user_4617da35-7fb8-4490-9394-67b62861b60f -> idea_986c4a5e-f73a-4265-a673-aab2bc042a50 = against
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 3,
  "sessions": 4
}
```

## 30. Admin votes AGAINST idea C

- Request: `POST /api/ideas/idea_986c4a5e-f73a-4265-a673-aab2bc042a50/vote`
- Auth context: `admin`
- Status: `200`
- Request body: 

```json
{
  "value": "against"
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Diana Director",
        "phone": "+79000000011...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.voteIdea()` записывает голос `against` в `state.votes` после проверки статуса и права голоса.
  - После каждого голоса пересчитывается статистика; если проголосовали все допустимые пользователи и поддержка не превысила 50%, идея архивируется как `rejected_by_vote`.
- Persisted state delta:

```text
- ideas:
  - updated idea_986c4a5e-f73a-4265-a673-aab2bc042a50: Idea C: Office karaoke night [voting]; updatedAt: 2026-03-11T18:35:38.493Z -> 2026-03-11T18:35:38.494Z
- votes:
  - added vote_1ea35a39-b73a-4818-adb0-f4a2dd943aca: user_c938f85d-9f07-481a-b8ae-5a37108ddfc2 -> idea_986c4a5e-f73a-4265-a673-aab2bc042a50 = against
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 4,
  "sessions": 4
}
```

## 31. Employee #2 casts the final AGAINST vote for idea C

- Request: `POST /api/ideas/idea_986c4a5e-f73a-4265-a673-aab2bc042a50/vote`
- Auth context: `employee2`
- Status: `200`
- Request body: 

```json
{
  "value": "against"
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "rejected_by_vote",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Diana Director",
        "phone": "+7...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.voteIdea()` записывает голос `against` в `state.votes` после проверки статуса и права голоса.
  - После каждого голоса пересчитывается статистика; если проголосовали все допустимые пользователи и поддержка не превысила 50%, идея архивируется как `rejected_by_vote`.
- Persisted state delta:

```text
- ideas:
  - updated idea_986c4a5e-f73a-4265-a673-aab2bc042a50: Idea C: Office karaoke night [rejected_by_vote]; status: voting -> rejected_by_vote; votingClosedAt: null -> 2026-03-11T18:35:38.494Z; archivedAt: null -> 2026-03-11T18:35:38.494Z
- votes:
  - added vote_a6fed022-cb84-45ac-9320-cdef7eedb111: user_a3c9d038-253a-4ba7-a171-891d4fce6199 -> idea_986c4a5e-f73a-4265-a673-aab2bc042a50 = against
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 5,
  "sessions": 4
}
```

## 32. Employee #1 views archive

- Request: `GET /api/ideas?scope=archive`
- Auth context: `employee1`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_986c4a5e-f73a-4265-a673-aab2bc042a50",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "title": "Idea C: Office karaoke night",
        "description": "Host a karaoke night in the office after work.",
        "descriptionPreview": "Host a karaoke night in the office after work.",
        "status": "rejected_by_vote",
        "scope": "archive",
        "archived": true,
        "author": {
          "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
          "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-11T18:35:38.327Z"
        },
        "moderation": {
          "reviewedBy": {
            "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
            "com...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.listIdeas()` читает все идеи компании, затем фильтрует их по `scope` и сортирует по `updatedAt` или поддержке.
  - Каждый элемент ответа обогащается через `buildIdeaPayload()`: автор, модерация, статистика голосов, доступные действия; состояние файла не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 5,
  "sessions": 4
}
```

## 33. Director opens idea A card

- Request: `GET /api/ideas/idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea`
- Auth context: `director`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "id": "idea_c073270a-d243-4f89-bf30-b2bdf54ba2ea",
    "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "approved_by_director",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_4617da35-7fb8-4490-9394-67b62861b60f",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.327Z"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_c938f85d-9f07-481a-b8ae-5a37108ddfc2",
        "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
        "fullName": "Alice Admin",
        "phone": "+7900...
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает Bearer-токен.
  - `service.getIdea()` ищет идею по `ideaId` внутри компании пользователя.
  - Ответ собирается через `buildIdeaPayload()` со статистикой голосов, таймлайном и доступными действиями, без изменения файла.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 5,
  "sessions": 4
}
```

## 34. Director requests company overview after all actions

- Request: `GET /api/company`
- Auth context: `director`
- Status: `200`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "company": {
      "id": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-11T18:35:38.241Z",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "currentUser": {
      "id": "user_5a1d2db5-e667-4dec-bd16-bcbeaa18ed28",
      "companyId": "company_00fa7f64-e288-410f-a4e5-4d8e5bdc3024",
      "fullName": "Diana Director",
      "phone": "+79000000011",
      "role": "director",
      "position": "Chief Executive Officer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-11T18:35:38.241Z"
    },
    "stats": {
      "employees": 4,
      "ideas": {
        "total": 3,
        "active": 0,
        "archive": 3,
        "pendingModeration": 0,
        "waitingForDirector": 0
      }
    }
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` валидирует Bearer-токен и поднимает контекст пользователя.
  - `service.getCompanyOverview()` читает компанию и пересчитывает агрегаты по идеям и сотрудникам.
  - Возвращается только чтение: статистика формируется на лету, состояние файла не меняется.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 5,
  "sessions": 4
}
```

## 35. Employee #1 logs out

- Request: `POST /api/auth/logout`
- Auth context: `employee1`
- Status: `204`
- Request body: `none`
- Response body: `none`
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` подтверждает текущую сессию по Bearer-токену.
  - `service.logout()` выполняет `FileStore.update()` и удаляет из `state.sessions` именно текущий токен.
  - Ответ пустой (`204`), остальные сессии и бизнес-данные не меняются.
- Persisted state delta:

```text
- sessions:
  - removed session_f6eaf070-fd63-431b-aac5-bd606f7df17f: user=user_4617da35-7fb8-4490-9394-67b62861b60f, expiresAt=2026-03-18T18:35:38.411Z
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 5,
  "sessions": 3
}
```

## 36. Old employee token is reused after logout

- Request: `GET /api/auth/me`
- Auth context: `employee1`
- Status: `401`
- Request body: `none`
- Response body: 

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "details": null
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `requireAuth` принимает Bearer-токен из заголовка.
  - `service.getContextByToken()` читает `sessions/users/companies`, но не находит валидную сессию.
  - Возвращается `401 Invalid or expired token`; сервис чтения профиля уже не вызывается.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 5,
  "sessions": 3
}
```

## 37. Unknown route returns 404

- Request: `GET /api/unknown-route`
- Auth context: `anonymous`
- Status: `404`
- Request body: `none`
- Response body: 

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route was not found"
  }
}
```
- Response headers (selected):

```json
{
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
}
```
- Internal flow:
  - `onRequest` добавляет CORS-заголовки.
  - Ни один маршрут не совпадает с URL.
  - `setNotFoundHandler` возвращает стандартизированный ответ `404 NOT_FOUND`.
- Persisted state delta:

```text
- no persisted state changes
```
- Persisted totals after request:

```json
{
  "companies": 1,
  "users": 4,
  "ideas": 3,
  "votes": 5,
  "sessions": 3
}
```
