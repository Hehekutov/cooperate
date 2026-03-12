# Cooperate Backend

ASP.NET Core backend for an internal company platform where employees create ideas, admins moderate them, coworkers vote, and the director makes the final decision.

## What is implemented

- company registration with director account creation
- login and token-based authentication
- employee management with `director`, `admin`, and `employee` roles
- idea lifecycle:
  - `pending_moderation`
  - `voting`
  - `director_review`
  - `rejected_by_admin`
  - `rejected_by_vote`
  - `approved_by_director`
  - `rejected_by_director`
- monthly rate limit: no more than 3 ideas per employee per UTC month
- active and archive idea views
- JSON-file persistence without external database dependencies
- seed mode built into the application

## Tech stack

- .NET 10 SDK
- ASP.NET Core Minimal API
- filesystem storage in `data/app-data.json`
- no external database or third-party packages

## Run

```bash
dotnet build
dotnet run
```

The server starts on `http://localhost:5000` and `https://localhost:5001` by default.

Quick local smoke check:

```bash
./scripts/smoke-test.sh
```

## Seed demo data

```bash
dotnet run -- seed
```

Seed credentials:

- director: `+70000000001` / `director123`
- admin: `+70000000002` / `admin123`
- employee: `+70000000003` / `employee123`
- employee: `+70000000004` / `employee123`

## Environment variables

- `ASPNETCORE_URLS` - bind address, example `http://0.0.0.0:3000`
- `DATA_FILE` - path to the JSON storage file, default `data/app-data.json`
- `CORS_ORIGIN` - allowed origin for browser requests, default `*`
- `SESSION_TTL_HOURS` - token lifetime, default `168`
- `IDEA_MONTHLY_LIMIT` - ideas per user per month, default `3`

## API overview

All authenticated endpoints expect:

```http
Authorization: Bearer <token>
```

### Health

- `GET /health`

### Auth

- `POST /api/auth/register-company`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Example registration payload:

```json
{
  "companyName": "Acme",
  "companyDescription": "Internal idea platform",
  "directorName": "Ivan Ivanov",
  "directorPosition": "Director",
  "phone": "+79990001122",
  "password": "secret123"
}
```

### Company and employees

- `GET /api/company` - company profile and counters
- `GET /api/employees` - list of company employees
- `POST /api/employees` - add an `admin` or `employee` account, director only

Example employee payload:

```json
{
  "fullName": "Sofia Kolbasenko",
  "phone": "+79990001123",
  "password": "secret123",
  "role": "admin",
  "position": "Office Administrator"
}
```

### Ideas

- `GET /api/ideas?scope=active`
- `GET /api/ideas?scope=archive`
- `GET /api/ideas?scope=mine`
- `GET /api/ideas?scope=moderation`
- `GET /api/ideas?scope=director_review`
- `GET /api/ideas/{ideaId}`
- `POST /api/ideas`
- `POST /api/ideas/{ideaId}/moderate`
- `POST /api/ideas/{ideaId}/vote`
- `POST /api/ideas/{ideaId}/decision`

Create idea payload:

```json
{
  "title": "Install a coffee machine",
  "description": "Employees spend too much time leaving the office for coffee."
}
```

Moderation payload:

```json
{
  "approved": true,
  "comment": "The request is clear and can go to voting."
}
```

Vote payload:

```json
{
  "value": "for"
}
```

Director decision payload:

```json
{
  "approved": false,
  "comment": "Rejected this quarter because of budget limits."
}
```

## Business rules

- the director registers the company and can add employees
- only the director can add new user accounts
- employees and admins can create ideas
- the director cannot vote and cannot create ideas
- admins or the director can moderate pending ideas
- voting percentage is calculated against the number of eligible non-director users captured at the moment voting starts
- if support becomes greater than `50%`, the idea moves to `director_review`
- if all eligible votes are cast and support is still `<= 50%`, the idea moves to `rejected_by_vote`
- final director decision moves the idea into the archive

## Response shape

Success payloads:

```json
{
  "data": {}
}
```

Error payloads:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Monthly limit reached: only 3 ideas are allowed per user",
    "details": null
  }
}
```
