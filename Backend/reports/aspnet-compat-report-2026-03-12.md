# ASP.NET Compatibility Test Report

- Date: 2026-03-12
- Workspace: `/Users/sskaaat/DevProjects/cooperate/Backend`
- Baseline for comparison: [server-test-report-2026-03-11.md](/Users/sskaaat/DevProjects/cooperate/Backend/reports/server-test-report-2026-03-11.md)
- Build: `dotnet build` succeeded.
- Test project presence: no dedicated ASP.NET test project was found; verification used real HTTP requests to the running app.

## Core scenario result

- Requests executed: 37
- Core mismatches: 0
- Final persisted state: `{"companies":1,"users":4,"ideas":3,"votes":5,"sessions":3}`
- Expected old-server final state: `{"companies":1,"users":4,"ideas":3,"votes":5,"sessions":3}`

### Core request log

#### 1. Health check

- Request: `GET /health`
- Auth context: `anonymous`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "status": "ok"
}
```
- State delta:

```text
- no persisted state changes
```

#### 2. CORS preflight

- Request: `OPTIONS /api/company`
- Auth context: `anonymous`
- Expected status: `204`
- Actual status: `204`
- Verdict: `MATCH`
- Request body: `none`
- Response body: `none`
- State delta:

```text
- no persisted state changes
```

#### 3. Protected route without token

- Request: `GET /api/company`
- Auth context: `anonymous`
- Expected status: `401`
- Actual status: `401`
- Verdict: `MATCH`
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
- State delta:

```text
- no persisted state changes
```

#### 4. Register company

- Request: `POST /api/auth/register-company`
- Auth context: `anonymous`
- Expected status: `201`
- Actual status: `201`
- Verdict: `MATCH`
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
    "token": "<redacted:b680c6>",
    "expiresAt": "2026-03-19T18:34:45.0730070+00:00",
    "company": {
      "id": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-12T18:34:45.0730070+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Diana Director",
      "phone": "+79000000011",
      "role": "director",
      "position": "Chief Executive Officer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.0730070+00:00"
    }
  }
}
```
- State delta:

```text
- companies:
  - added company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb: Acme Rocket
- users:
  - added user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71: Diana Director (director)
- sessions:
  - added session_632da0c0-4208-4d23-a855-5f3f01f0437a: user=user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71, expiresAt=2026-03-19T18:34:45.0730070+00:00
```

#### 5. Director profile

- Request: `GET /api/auth/me`
- Auth context: `director`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "user": {
      "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Diana Director",
      "phone": "+79000000011",
      "role": "director",
      "position": "Chief Executive Officer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.0730070+00:00"
    },
    "company": {
      "id": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-12T18:34:45.0730070+00:00",
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
- State delta:

```text
- no persisted state changes
```

#### 6. Create admin

- Request: `POST /api/employees`
- Auth context: `director`
- Expected status: `201`
- Actual status: `201`
- Verdict: `MATCH`
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
    "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "fullName": "Alice Admin",
    "phone": "+79000000012",
    "role": "admin",
    "position": "Operations Admin",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-12T18:34:45.1120070+00:00"
  }
}
```
- State delta:

```text
- users:
  - added user_b6a4e43e-e664-4534-b625-c293f473eac4: Alice Admin (admin)
```

#### 7. Create employee #1

- Request: `POST /api/employees`
- Auth context: `director`
- Expected status: `201`
- Actual status: `201`
- Verdict: `MATCH`
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
    "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "fullName": "Egor Employee",
    "phone": "+79000000013",
    "role": "employee",
    "position": "Developer",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-12T18:34:45.1287180+00:00"
  }
}
```
- State delta:

```text
- users:
  - added user_6a4b2234-6269-4743-992a-4ab5181eca8b: Egor Employee (employee)
```

#### 8. Create employee #2

- Request: `POST /api/employees`
- Auth context: `director`
- Expected status: `201`
- Actual status: `201`
- Verdict: `MATCH`
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
    "id": "user_dfe195ec-6026-4bca-9ad6-25e469c2de9b",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "fullName": "Mila Employee",
    "phone": "+79000000014",
    "role": "employee",
    "position": "Designer",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-12T18:34:45.1450590+00:00"
  }
}
```
- State delta:

```text
- users:
  - added user_dfe195ec-6026-4bca-9ad6-25e469c2de9b: Mila Employee (employee)
```

#### 9. Admin login

- Request: `POST /api/auth/login`
- Auth context: `anonymous`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "token": "<redacted:ede1d3>",
    "expiresAt": "2026-03-19T18:34:45.1625210+00:00",
    "company": {
      "id": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-12T18:34:45.0730070+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Alice Admin",
      "phone": "+79000000012",
      "role": "admin",
      "position": "Operations Admin",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1120070+00:00"
    }
  }
}
```
- State delta:

```text
- sessions:
  - added session_c21fd427-6af1-4079-94b4-a924987f6bb4: user=user_b6a4e43e-e664-4534-b625-c293f473eac4, expiresAt=2026-03-19T18:34:45.1625210+00:00
```

#### 10. Employee #1 login

- Request: `POST /api/auth/login`
- Auth context: `anonymous`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "token": "<redacted:01c6cd>",
    "expiresAt": "2026-03-19T18:34:45.1785740+00:00",
    "company": {
      "id": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-12T18:34:45.0730070+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    }
  }
}
```
- State delta:

```text
- sessions:
  - added session_eef7ff9e-434c-4dde-bb21-6a77ef104b2c: user=user_6a4b2234-6269-4743-992a-4ab5181eca8b, expiresAt=2026-03-19T18:34:45.1785740+00:00
```

#### 11. Employee #2 login

- Request: `POST /api/auth/login`
- Auth context: `anonymous`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "token": "<redacted:d66125>",
    "expiresAt": "2026-03-19T18:34:45.1947770+00:00",
    "company": {
      "id": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-12T18:34:45.0730070+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_dfe195ec-6026-4bca-9ad6-25e469c2de9b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Mila Employee",
      "phone": "+79000000014",
      "role": "employee",
      "position": "Designer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1450590+00:00"
    }
  }
}
```
- State delta:

```text
- sessions:
  - added session_4198addb-66e7-465a-98ef-e8a381d721c0: user=user_dfe195ec-6026-4bca-9ad6-25e469c2de9b, expiresAt=2026-03-19T18:34:45.1947770+00:00
```

#### 12. Employee directory

- Request: `GET /api/employees`
- Auth context: `director`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Diana Director",
        "phone": "+79000000011",
        "role": "director",
        "position": "Chief Executive Officer",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.0730070+00:00"
      },
      {
        "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1120070+00:00"
      },
      {
        "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Egor Employee",
        "phone": "+79000000013",
        "role": "employee",
        "position": "Developer",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1287180+00:00"
  ...
```
- State delta:

```text
- no persisted state changes
```

#### 13. Employee forbidden to create users

- Request: `POST /api/employees`
- Auth context: `employee1`
- Expected status: `403`
- Actual status: `403`
- Verdict: `MATCH`
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
- State delta:

```text
- no persisted state changes
```

#### 14. Director forbidden to create idea

- Request: `POST /api/ideas`
- Auth context: `director`
- Expected status: `403`
- Actual status: `403`
- Verdict: `MATCH`
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
- State delta:

```text
- no persisted state changes
```

#### 15. Employee #1 creates idea A

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Expected status: `201`
- Actual status: `201`
- Verdict: `MATCH`
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
    "id": "idea_94b21655-dd85-4c45-a80c-7ada23b7139c",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "pending_moderation",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
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
      "approvalPercent": 0,
      "thresholdPercent": 50,
      "passed": false
    },
    "viewerVote": null,
    "directorDecision": {
      "decidedBy": null,
      "comment": null,
      "d...
```
- State delta:

```text
- ideas:
  - added idea_94b21655-dd85-4c45-a80c-7ada23b7139c: Idea A: Coffee machine [pending_moderation]
```

#### 16. Employee #1 creates idea B

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Expected status: `201`
- Actual status: `201`
- Verdict: `MATCH`
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
    "id": "idea_8491ac7f-c321-4c88-80ad-98094aad9f67",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea B: New chairs",
    "description": "Replace chairs in the open space area.",
    "descriptionPreview": "Replace chairs in the open space area.",
    "status": "pending_moderation",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
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
      "approvalPercent": 0,
      "thresholdPercent": 50,
      "passed": false
    },
    "viewerVote": null,
    "directorDecision": {
      "decidedBy": null,
      "comment": null,
      "decidedAt": null,
     ...
```
- State delta:

```text
- ideas:
  - added idea_8491ac7f-c321-4c88-80ad-98094aad9f67: Idea B: New chairs [pending_moderation]
```

#### 17. Employee #1 creates idea C

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Expected status: `201`
- Actual status: `201`
- Verdict: `MATCH`
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
    "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "pending_moderation",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
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
      "approvalPercent": 0,
      "thresholdPercent": 50,
      "passed": false
    },
    "viewerVote": null,
    "directorDecision": {
      "decidedBy": null,
      "comment": null,
    ...
```
- State delta:

```text
- ideas:
  - added idea_e676437e-9597-4e49-8b7f-34ec4bd46781: Idea C: Office karaoke night [pending_moderation]
```

#### 18. Employee #1 exceeds monthly limit

- Request: `POST /api/ideas`
- Auth context: `employee1`
- Expected status: `409`
- Actual status: `409`
- Verdict: `MATCH`
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
- State delta:

```text
- no persisted state changes
```

#### 19. Mine scope list

- Request: `GET /api/ideas?scope=mine`
- Auth context: `employee1`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "title": "Idea C: Office karaoke night",
        "description": "Host a karaoke night in the office after work.",
        "descriptionPreview": "Host a karaoke night in the office after work.",
        "status": "pending_moderation",
        "scope": "active",
        "archived": false,
        "author": {
          "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
          "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-12T18:34:45.1287180+00:00"
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
          "approvalPercent": 0,
          "thr...
```
- State delta:

```text
- no persisted state changes
```

#### 20. Admin approves idea A

- Request: `POST /api/ideas/idea_94b21655-dd85-4c45-a80c-7ada23b7139c/moderate`
- Auth context: `admin`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_94b21655-dd85-4c45-a80c-7ada23b7139c",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1120070+00:00"
      },
      "comm...
```
- State delta:

```text
- ideas:
  - updated idea_94b21655-dd85-4c45-a80c-7ada23b7139c: Idea A: Coffee machine [voting]; status: pending_moderation -> voting; moderationComment: null -> Clear request, start voting.; moderatedAt: null -> 2026-03-12T18:34:45.2419860+00:00; moderatedBy: null -> user_b6a4e43e-e664-4534-b625-c293f473eac4; votingEligibleUserIds: [] -> [user_b6a4e43e-e664-4534-b625-c293f473eac4, user_6a4b2234-6269-4743-992a-4ab5181eca8b, user_dfe195ec-6026-4bca-9ad6-25e469c2de9b]; votingOpenedAt: null -> 2026-03-12T18:34:45.2419860+00:00; updatedAt: 2026-03-12T18:34:45.2197110+00:00 -> 2026-03-12T18:34:45.2419860+00:00
```

#### 21. Admin rejects idea B

- Request: `POST /api/ideas/idea_8491ac7f-c321-4c88-80ad-98094aad9f67/moderate`
- Auth context: `admin`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_8491ac7f-c321-4c88-80ad-98094aad9f67",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea B: New chairs",
    "description": "Replace chairs in the open space area.",
    "descriptionPreview": "Replace chairs in the open space area.",
    "status": "rejected_by_admin",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1120070+00:00"
      },
      "comment": "Budg...
```
- State delta:

```text
- ideas:
  - updated idea_8491ac7f-c321-4c88-80ad-98094aad9f67: Idea B: New chairs [rejected_by_admin]; status: pending_moderation -> rejected_by_admin; moderationComment: null -> Budget is already allocated.; moderatedAt: null -> 2026-03-12T18:34:45.2439410+00:00; moderatedBy: null -> user_b6a4e43e-e664-4534-b625-c293f473eac4; archivedAt: null -> 2026-03-12T18:34:45.2439410+00:00; updatedAt: 2026-03-12T18:34:45.2294930+00:00 -> 2026-03-12T18:34:45.2439410+00:00
```

#### 22. Director approves idea C

- Request: `POST /api/ideas/idea_e676437e-9597-4e49-8b7f-34ec4bd46781/moderate`
- Auth context: `director`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Diana Director",
        "phone": "+79000000011",
        "role": "director",
        "position": "Chief Executive Officer",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.0730070+00:00"
   ...
```
- State delta:

```text
- ideas:
  - updated idea_e676437e-9597-4e49-8b7f-34ec4bd46781: Idea C: Office karaoke night [voting]; status: pending_moderation -> voting; moderationComment: null -> Let the team vote.; moderatedAt: null -> 2026-03-12T18:34:45.2455660+00:00; moderatedBy: null -> user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71; votingEligibleUserIds: [] -> [user_b6a4e43e-e664-4534-b625-c293f473eac4, user_6a4b2234-6269-4743-992a-4ab5181eca8b, user_dfe195ec-6026-4bca-9ad6-25e469c2de9b]; votingOpenedAt: null -> 2026-03-12T18:34:45.2455660+00:00; updatedAt: 2026-03-12T18:34:45.2314010+00:00 -> 2026-03-12T18:34:45.2455660+00:00
```

#### 23. Active scope list

- Request: `GET /api/ideas?scope=active`
- Auth context: `employee1`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "title": "Idea C: Office karaoke night",
        "description": "Host a karaoke night in the office after work.",
        "descriptionPreview": "Host a karaoke night in the office after work.",
        "status": "voting",
        "scope": "active",
        "archived": false,
        "author": {
          "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
          "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-12T18:34:45.1287180+00:00"
        },
        "moderation": {
          "reviewedBy": {
            "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
            "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
            "fullName": "Diana Director",
            "phone": "+79000000011",
            "role": "director",
            "position": "Chief Ex...
```
- State delta:

```text
- no persisted state changes
```

#### 24. Employee #1 votes FOR idea A

- Request: `POST /api/ideas/idea_94b21655-dd85-4c45-a80c-7ada23b7139c/vote`
- Auth context: `employee1`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_94b21655-dd85-4c45-a80c-7ada23b7139c",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1120070+00:00"
      },
      "comm...
```
- State delta:

```text
- ideas:
  - updated idea_94b21655-dd85-4c45-a80c-7ada23b7139c: Idea A: Coffee machine [voting]; updatedAt: 2026-03-12T18:34:45.2419860+00:00 -> 2026-03-12T18:34:45.2507140+00:00
- votes:
  - added vote_69a03582-283c-4a0c-b513-9d75a355215e: user_6a4b2234-6269-4743-992a-4ab5181eca8b -> idea_94b21655-dd85-4c45-a80c-7ada23b7139c = for
```

#### 25. Employee #1 double vote blocked

- Request: `POST /api/ideas/idea_94b21655-dd85-4c45-a80c-7ada23b7139c/vote`
- Auth context: `employee1`
- Expected status: `409`
- Actual status: `409`
- Verdict: `MATCH`
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
- State delta:

```text
- no persisted state changes
```

#### 26. Admin votes FOR idea A

- Request: `POST /api/ideas/idea_94b21655-dd85-4c45-a80c-7ada23b7139c/vote`
- Auth context: `admin`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_94b21655-dd85-4c45-a80c-7ada23b7139c",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "director_review",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1120070+00:00"
      },
  ...
```
- State delta:

```text
- ideas:
  - updated idea_94b21655-dd85-4c45-a80c-7ada23b7139c: Idea A: Coffee machine [director_review]; status: voting -> director_review; votingClosedAt: null -> 2026-03-12T18:34:45.2540460+00:00; directorReviewRequestedAt: null -> 2026-03-12T18:34:45.2540460+00:00; updatedAt: 2026-03-12T18:34:45.2507140+00:00 -> 2026-03-12T18:34:45.2540460+00:00
- votes:
  - added vote_91c8cbb4-cda4-4250-ba67-fc9d33b8ee01: user_b6a4e43e-e664-4534-b625-c293f473eac4 -> idea_94b21655-dd85-4c45-a80c-7ada23b7139c = for
```

#### 27. Director review scope list

- Request: `GET /api/ideas?scope=director_review`
- Auth context: `director`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_94b21655-dd85-4c45-a80c-7ada23b7139c",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "title": "Idea A: Coffee machine",
        "description": "Install a coffee machine in the office kitchen.",
        "descriptionPreview": "Install a coffee machine in the office kitchen.",
        "status": "director_review",
        "scope": "active",
        "archived": false,
        "author": {
          "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
          "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-12T18:34:45.1287180+00:00"
        },
        "moderation": {
          "reviewedBy": {
            "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
            "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
            "fullName": "Alice Admin",
            "phone": "+79000000012",
            "role": "admin",
            "position": "Operation...
```
- State delta:

```text
- no persisted state changes
```

#### 28. Director approves idea A

- Request: `POST /api/ideas/idea_94b21655-dd85-4c45-a80c-7ada23b7139c/decision`
- Auth context: `director`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_94b21655-dd85-4c45-a80c-7ada23b7139c",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "approved_by_director",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1120070+00:00"
      ...
```
- State delta:

```text
- ideas:
  - updated idea_94b21655-dd85-4c45-a80c-7ada23b7139c: Idea A: Coffee machine [approved_by_director]; status: director_review -> approved_by_director; directorDecisionAt: null -> 2026-03-12T18:34:45.2571510+00:00; directorDecisionBy: null -> user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71; directorComment: null -> Approved for the next quarter.; archivedAt: null -> 2026-03-12T18:34:45.2571510+00:00; updatedAt: 2026-03-12T18:34:45.2540460+00:00 -> 2026-03-12T18:34:45.2571510+00:00
```

#### 29. Employee #1 votes AGAINST idea C

- Request: `POST /api/ideas/idea_e676437e-9597-4e49-8b7f-34ec4bd46781/vote`
- Auth context: `employee1`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Diana Director",
        "phone": "+79000000011",
        "role": "director",
        "position": "Chief Executive Officer",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.0730070+00:00"
   ...
```
- State delta:

```text
- ideas:
  - updated idea_e676437e-9597-4e49-8b7f-34ec4bd46781: Idea C: Office karaoke night [voting]; updatedAt: 2026-03-12T18:34:45.2455660+00:00 -> 2026-03-12T18:34:45.2702760+00:00
- votes:
  - added vote_2c1c2ed9-edae-44c6-9c33-8e06fa5e0867: user_6a4b2234-6269-4743-992a-4ab5181eca8b -> idea_e676437e-9597-4e49-8b7f-34ec4bd46781 = against
```

#### 30. Admin votes AGAINST idea C

- Request: `POST /api/ideas/idea_e676437e-9597-4e49-8b7f-34ec4bd46781/vote`
- Auth context: `admin`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "voting",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Diana Director",
        "phone": "+79000000011",
        "role": "director",
        "position": "Chief Executive Officer",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.0730070+00:00"
   ...
```
- State delta:

```text
- ideas:
  - updated idea_e676437e-9597-4e49-8b7f-34ec4bd46781: Idea C: Office karaoke night [voting]; updatedAt: 2026-03-12T18:34:45.2702760+00:00 -> 2026-03-12T18:34:45.2992440+00:00
- votes:
  - added vote_be2201fc-6aad-4eba-82c8-72fb67e25d0f: user_b6a4e43e-e664-4534-b625-c293f473eac4 -> idea_e676437e-9597-4e49-8b7f-34ec4bd46781 = against
```

#### 31. Employee #2 final AGAINST vote

- Request: `POST /api/ideas/idea_e676437e-9597-4e49-8b7f-34ec4bd46781/vote`
- Auth context: `employee2`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
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
    "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea C: Office karaoke night",
    "description": "Host a karaoke night in the office after work.",
    "descriptionPreview": "Host a karaoke night in the office after work.",
    "status": "rejected_by_vote",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Diana Director",
        "phone": "+79000000011",
        "role": "director",
        "position": "Chief Executive Officer",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.0730070+...
```
- State delta:

```text
- ideas:
  - updated idea_e676437e-9597-4e49-8b7f-34ec4bd46781: Idea C: Office karaoke night [rejected_by_vote]; status: voting -> rejected_by_vote; votingClosedAt: null -> 2026-03-12T18:34:45.3501570+00:00; archivedAt: null -> 2026-03-12T18:34:45.3501570+00:00; updatedAt: 2026-03-12T18:34:45.2992440+00:00 -> 2026-03-12T18:34:45.3501570+00:00
- votes:
  - added vote_fe1272e7-843b-4384-9b4e-14d1da6d9ac2: user_dfe195ec-6026-4bca-9ad6-25e469c2de9b -> idea_e676437e-9597-4e49-8b7f-34ec4bd46781 = against
```

#### 32. Archive scope list

- Request: `GET /api/ideas?scope=archive`
- Auth context: `employee1`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "items": [
      {
        "id": "idea_e676437e-9597-4e49-8b7f-34ec4bd46781",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "title": "Idea C: Office karaoke night",
        "description": "Host a karaoke night in the office after work.",
        "descriptionPreview": "Host a karaoke night in the office after work.",
        "status": "rejected_by_vote",
        "scope": "archive",
        "archived": true,
        "author": {
          "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
          "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
          "fullName": "Egor Employee",
          "phone": "+79000000013",
          "role": "employee",
          "position": "Developer",
          "avatarUrl": null,
          "isActive": true,
          "createdAt": "2026-03-12T18:34:45.1287180+00:00"
        },
        "moderation": {
          "reviewedBy": {
            "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
            "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
            "fullName": "Diana Director",
            "phone": "+79000000011",
            "role": "director",
            "position":...
```
- State delta:

```text
- no persisted state changes
```

#### 33. Open idea A card

- Request: `GET /api/ideas/idea_94b21655-dd85-4c45-a80c-7ada23b7139c`
- Auth context: `director`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "id": "idea_94b21655-dd85-4c45-a80c-7ada23b7139c",
    "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
    "title": "Idea A: Coffee machine",
    "description": "Install a coffee machine in the office kitchen.",
    "descriptionPreview": "Install a coffee machine in the office kitchen.",
    "status": "approved_by_director",
    "scope": "archive",
    "archived": true,
    "author": {
      "id": "user_6a4b2234-6269-4743-992a-4ab5181eca8b",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Egor Employee",
      "phone": "+79000000013",
      "role": "employee",
      "position": "Developer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.1287180+00:00"
    },
    "moderation": {
      "reviewedBy": {
        "id": "user_b6a4e43e-e664-4534-b625-c293f473eac4",
        "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
        "fullName": "Alice Admin",
        "phone": "+79000000012",
        "role": "admin",
        "position": "Operations Admin",
        "avatarUrl": null,
        "isActive": true,
        "createdAt": "2026-03-12T18:34:45.1120070+00:00"
      ...
```
- State delta:

```text
- no persisted state changes
```

#### 34. Final company overview

- Request: `GET /api/company`
- Auth context: `director`
- Expected status: `200`
- Actual status: `200`
- Verdict: `MATCH`
- Request body: `none`
- Response body: 

```json
{
  "data": {
    "company": {
      "id": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "name": "Acme Rocket",
      "description": "Internal platform for ideas and voting",
      "createdAt": "2026-03-12T18:34:45.0730070+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "currentUser": {
      "id": "user_b0ecf464-cbdb-4b59-ab5e-e3c4769c4d71",
      "companyId": "company_17ab9de9-0854-4ef8-8d33-e43b25a4efbb",
      "fullName": "Diana Director",
      "phone": "+79000000011",
      "role": "director",
      "position": "Chief Executive Officer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.0730070+00:00"
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
- State delta:

```text
- no persisted state changes
```

#### 35. Employee #1 logout

- Request: `POST /api/auth/logout`
- Auth context: `employee1`
- Expected status: `204`
- Actual status: `204`
- Verdict: `MATCH`
- Request body: `none`
- Response body: `none`
- State delta:

```text
- sessions:
  - removed session_eef7ff9e-434c-4dde-bb21-6a77ef104b2c: user=user_6a4b2234-6269-4743-992a-4ab5181eca8b, expiresAt=2026-03-19T18:34:45.1785740+00:00
```

#### 36. Old token after logout

- Request: `GET /api/auth/me`
- Auth context: `employee1`
- Expected status: `401`
- Actual status: `401`
- Verdict: `MATCH`
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
- State delta:

```text
- no persisted state changes
```

#### 37. Unknown route

- Request: `GET /api/unknown-route`
- Auth context: `anonymous`
- Expected status: `404`
- Actual status: `404`
- Verdict: `MATCH`
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
- State delta:

```text
- no persisted state changes
```

## Validation parity probes

- Probes executed: 11
- Mismatches vs old Fastify validation behavior: 0

#### Probe 1. Register with extra unexpected field

- Request: `POST /api/auth/register-company`
- Expected old status: `400`
- Actual ASP.NET status: `400`
- Verdict: `MATCH`
- Why this matters: Old Fastify route had additionalProperties=false
- Request body: 

```json
{
  "companyName": "Probe Co",
  "directorName": "Director Probe",
  "phone": "+70000001001",
  "password": "director123",
  "unexpected": "extra"
}
```
- Response body: 

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "body/unexpected must NOT have additional properties",
    "details": [
      {
        "field": "body/unexpected",
        "message": "must NOT have additional properties"
      }
    ]
  }
}
```
- State delta:

```text
- no persisted state changes
```

#### Probe 2. Fallback valid registration

- Request: `POST /api/auth/register-company`
- Expected old status: `201`
- Actual ASP.NET status: `201`
- Verdict: `MATCH`
- Request body: 

```json
{
  "companyName": "Probe Co",
  "directorName": "Director Probe",
  "phone": "+70000001002",
  "password": "director123"
}
```
- Response body: 

```json
{
  "data": {
    "token": "<redacted:0d3272>",
    "expiresAt": "2026-03-19T18:34:45.9477010+00:00",
    "company": {
      "id": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
      "name": "Probe Co",
      "description": null,
      "createdAt": "2026-03-12T18:34:45.9477010+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_db07078f-cb69-417e-9655-9cdc3cee9e97",
      "companyId": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
      "fullName": "Director Probe",
      "phone": "+70000001002",
      "role": "director",
      "position": "Director",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.9477010+00:00"
    }
  }
}
```
- State delta:

```text
- companies:
  - added company_7158a746-c478-4d3f-8c9c-02ec0386bc26: Probe Co
- users:
  - added user_db07078f-cb69-417e-9655-9cdc3cee9e97: Director Probe (director)
- sessions:
  - added session_b03b85bd-0f4a-4fc2-a47c-b4d428be56ee: user=user_db07078f-cb69-417e-9655-9cdc3cee9e97, expiresAt=2026-03-19T18:34:45.9477010+00:00
```

#### Probe 3. Create probe admin

- Request: `POST /api/employees`
- Expected old status: `201`
- Actual ASP.NET status: `201`
- Verdict: `MATCH`
- Request body: 

```json
{
  "fullName": "Probe Admin",
  "phone": "+70000001003",
  "password": "admin123",
  "role": "admin",
  "position": "Admin"
}
```
- Response body: 

```json
{
  "data": {
    "id": "user_27dee34f-0001-4b62-83b3-53e5e75b2151",
    "companyId": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
    "fullName": "Probe Admin",
    "phone": "+70000001003",
    "role": "admin",
    "position": "Admin",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-12T18:34:45.9799490+00:00"
  }
}
```
- State delta:

```text
- users:
  - added user_27dee34f-0001-4b62-83b3-53e5e75b2151: Probe Admin (admin)
```

#### Probe 4. Create probe employee

- Request: `POST /api/employees`
- Expected old status: `201`
- Actual ASP.NET status: `201`
- Verdict: `MATCH`
- Request body: 

```json
{
  "fullName": "Probe Employee",
  "phone": "+70000001004",
  "password": "employee123",
  "role": "employee",
  "position": "Engineer"
}
```
- Response body: 

```json
{
  "data": {
    "id": "user_dfdd277b-453b-4f20-bd4d-ae4bd678cec3",
    "companyId": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
    "fullName": "Probe Employee",
    "phone": "+70000001004",
    "role": "employee",
    "position": "Engineer",
    "avatarUrl": null,
    "isActive": true,
    "createdAt": "2026-03-12T18:34:45.9954680+00:00"
  }
}
```
- State delta:

```text
- users:
  - added user_dfdd277b-453b-4f20-bd4d-ae4bd678cec3: Probe Employee (employee)
```

#### Probe 5. Probe admin login

- Request: `POST /api/auth/login`
- Expected old status: `200`
- Actual ASP.NET status: `200`
- Verdict: `MATCH`
- Request body: 

```json
{
  "phone": "+70000001003",
  "password": "admin123"
}
```
- Response body: 

```json
{
  "data": {
    "token": "<redacted:02dd33>",
    "expiresAt": "2026-03-19T18:34:46.0115830+00:00",
    "company": {
      "id": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
      "name": "Probe Co",
      "description": null,
      "createdAt": "2026-03-12T18:34:45.9477010+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_27dee34f-0001-4b62-83b3-53e5e75b2151",
      "companyId": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
      "fullName": "Probe Admin",
      "phone": "+70000001003",
      "role": "admin",
      "position": "Admin",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.9799490+00:00"
    }
  }
}
```
- State delta:

```text
- sessions:
  - added session_8392bc46-fa26-4872-a6af-95a41ebc1cc9: user=user_27dee34f-0001-4b62-83b3-53e5e75b2151, expiresAt=2026-03-19T18:34:46.0115830+00:00
```

#### Probe 6. Probe employee login

- Request: `POST /api/auth/login`
- Expected old status: `200`
- Actual ASP.NET status: `200`
- Verdict: `MATCH`
- Request body: 

```json
{
  "phone": "+70000001004",
  "password": "employee123"
}
```
- Response body: 

```json
{
  "data": {
    "token": "<redacted:a28be1>",
    "expiresAt": "2026-03-19T18:34:46.0284810+00:00",
    "company": {
      "id": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
      "name": "Probe Co",
      "description": null,
      "createdAt": "2026-03-12T18:34:45.9477010+00:00",
      "settings": {
        "ideaMonthlyLimit": 3,
        "voteApprovalPercent": 50
      }
    },
    "user": {
      "id": "user_dfdd277b-453b-4f20-bd4d-ae4bd678cec3",
      "companyId": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
      "fullName": "Probe Employee",
      "phone": "+70000001004",
      "role": "employee",
      "position": "Engineer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.9954680+00:00"
    }
  }
}
```
- State delta:

```text
- sessions:
  - added session_982235ab-fdd6-4d84-af02-b78d1d032198: user=user_dfdd277b-453b-4f20-bd4d-ae4bd678cec3, expiresAt=2026-03-19T18:34:46.0284810+00:00
```

#### Probe 7. Probe employee creates idea

- Request: `POST /api/ideas`
- Expected old status: `201`
- Actual ASP.NET status: `201`
- Verdict: `MATCH`
- Request body: 

```json
{
  "title": "Probe idea",
  "description": "Used for validation compatibility checks."
}
```
- Response body: 

```json
{
  "data": {
    "id": "idea_22b875e1-1a3b-49fe-9208-e8414c00b3bf",
    "companyId": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
    "title": "Probe idea",
    "description": "Used for validation compatibility checks.",
    "descriptionPreview": "Used for validation compatibility checks.",
    "status": "pending_moderation",
    "scope": "active",
    "archived": false,
    "author": {
      "id": "user_dfdd277b-453b-4f20-bd4d-ae4bd678cec3",
      "companyId": "company_7158a746-c478-4d3f-8c9c-02ec0386bc26",
      "fullName": "Probe Employee",
      "phone": "+70000001004",
      "role": "employee",
      "position": "Engineer",
      "avatarUrl": null,
      "isActive": true,
      "createdAt": "2026-03-12T18:34:45.9954680+00:00"
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
      "approvalPercent": 0,
      "thresholdPercent": 50,
      "passed": false
    },
    "viewerVote": null,
    "directorDecision": {
      "decidedBy": null,
      "comment": null,
      "decidedAt": null,
      "...
```
- State delta:

```text
- ideas:
  - added idea_22b875e1-1a3b-49fe-9208-e8414c00b3bf: Probe idea [pending_moderation]
```

#### Probe 8. Moderation with missing approved field

- Request: `POST /api/ideas/idea_22b875e1-1a3b-49fe-9208-e8414c00b3bf/moderate`
- Expected old status: `400`
- Actual ASP.NET status: `400`
- Verdict: `MATCH`
- Why this matters: Old Fastify route required body.approved
- Request body: 

```json
{}
```
- Response body: 

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "body/approved is required",
    "details": [
      {
        "field": "body/approved",
        "message": "is required"
      }
    ]
  }
}
```
- State delta:

```text
- no persisted state changes
```

#### Probe 9. Ideas query with invalid status enum

- Request: `GET /api/ideas?status=not_a_real_status`
- Expected old status: `400`
- Actual ASP.NET status: `400`
- Verdict: `MATCH`
- Why this matters: Old Fastify route validated query.status against enum
- Request body: `none`
- Response body: 

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "querystring/status must be one of: pending_moderation, voting, director_review, rejected_by_admin, rejected_by_vote, approved_by_director, rejected_by_director",
    "details": [
      {
        "field": "querystring/status",
        "message": "must be one of: pending_moderation, voting, director_review, rejected_by_admin, rejected_by_vote, approved_by_director, rejected_by_director"
      }
    ]
  }
}
```
- State delta:

```text
- no persisted state changes
```

#### Probe 10. Ideas query with invalid sort enum

- Request: `GET /api/ideas?sort=wrong`
- Expected old status: `400`
- Actual ASP.NET status: `400`
- Verdict: `MATCH`
- Why this matters: Old Fastify route validated query.sort against enum
- Request body: `none`
- Response body: 

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "querystring/sort must be one of: recent, support",
    "details": [
      {
        "field": "querystring/sort",
        "message": "must be one of: recent, support"
      }
    ]
  }
}
```
- State delta:

```text
- no persisted state changes
```

#### Probe 11. Ideas query with invalid limit range

- Request: `GET /api/ideas?limit=0`
- Expected old status: `400`
- Actual ASP.NET status: `400`
- Verdict: `MATCH`
- Why this matters: Old Fastify route required query.limit >= 1
- Request body: `none`
- Response body: 

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "querystring/limit must be >= 1",
    "details": [
      {
        "field": "querystring/limit",
        "message": "must be >= 1"
      }
    ]
  }
}
```
- State delta:

```text
- no persisted state changes
```
