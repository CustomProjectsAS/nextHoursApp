# CP Hours — V1 Production Checklist (HONEST)

This file is a **truth contract**. A box is checked only when it is true in the codebase **today**.

Legend:
- ✅ Done = implemented and present in the repo
- ⏳ In progress = partially migrated / mixed state
- ⬜ Not started

---

## Gate 1 — API Contract Consistency ✅ DONE

Canonical API contract (locked)
- Success: `{ ok: true, data: ... }`
- Error: `{ ok: false, error: { code, message } }`

Helpers (locked)
- `lib/api/response.ts` → `ok`, `fail`
- `lib/api/nextResponse.ts` → `okNext`, `failNext`

### 1.1 Migrate ALL API routes to helpers ✅ DONE
Rule:
- API routes must use the helpers (`ok/okNext`, `fail/failNext`).
- No ad-hoc `NextResponse.json(...)` response shapes.

Inventory (from repo):
- [x] app/api/admin/dashboard/route.ts
- [x] app/api/admin/invite/route.ts
- [x] app/api/admin/hours/route.ts
- [x] app/api/admin/hours/[id]/route.ts
- [x] app/api/admin/hours/[id]/approve/route.ts
- [x] app/api/admin/hours/[id]/reject/route.ts
- [x] app/api/admin/hours/[id]/delete/route.ts
- [x] app/api/admin/employees/route.ts
- [x] app/api/admin/employees/[id]/disable/route.ts
- [x] app/api/admin/projects/route.ts
- [x] app/api/admin/projects/[id]/route.ts
- [x] app/api/admin/projects/[id]/disable/route.ts

- [x] app/api/auth/signup/route.ts
- [x] app/api/auth/login/route.ts
- [x] app/api/auth/login/choose-company/route.ts
- [x] app/api/auth/me/route.ts
- [x] app/api/auth/logout/route.ts

- [x] app/api/onboarding/validate/route.ts
- [x] app/api/onboarding/complete/route.ts

- [x] app/api/employee/hours/route.ts
- [x] app/api/employee/hours/[id]/route.ts

- [x] app/api/employees/route.ts
- [x] app/api/projects/route.ts
- [x] app/api/health/route.ts

---

### Gate 1.2 — UI Consumers (API Contract Compliance) ✅ DONE

Rule:
All frontend consumers must read API responses using:
- Success → `{ ok: true, data }`
- Error   → `{ ok: false, error: { code, message } }`

Allowed exception:
- “Fire-and-forget” calls (example: logout) may ignore the response body.

A file can be checked ONLY when **all API calls inside it** comply.

#### Admin UI
- [x] app/admin/page.tsx
  - GET `/api/auth/me`
  - GET `/api/admin/dashboard`

- [x] app/admin/employees/page.tsx
  - GET `/api/employees`

- [x] app/admin/projects/page.tsx
  - GET `/api/projects`
  - GET `/api/admin/projects`
  - POST `/api/admin/projects`

- [x] app/admin/hours/page.tsx
  - GET `/api/admin/hours`
  - POST `/api/admin/hours/[id]/approve`
  - POST `/api/admin/hours/[id]/reject`

- [x] app/admin/timeline/page.tsx
  - GET `/api/admin/hours`

#### Employee UI
- [x] app/employee/page.tsx
  - GET `/api/auth/me`
  - GET `/api/projects`
  - GET `/api/employee/hours`
  - POST `/api/employee/hours`
  - PATCH `/api/employee/hours/[id]`
  - POST `/api/auth/logout` (fire-and-forget allowed)

#### Auth / Onboarding UI
- [x] app/login/page.tsx
  - POST `/api/auth/login`

- [x] app/signup/page.tsx
  - POST `/api/auth/signup`

- [x] app/onboarding/page.tsx
  - GET `/api/onboarding/validate`
  - POST `/api/onboarding/complete`
  - GET `/api/auth/me`

#### Root
- [x] app/page.tsx
  - GET `/api/auth/me`

#### Gate 1.2 completion rule
- [x] All UI consumers correctly handle `{ ok, data } / { ok, error }` (with the allowed fire-and-forget exception)

---

## Gate 2 — Request ID + Structured Logging ✅ DONE

### 2.0 Canonical rules (NEXT hardening targets — not required for Gate 2 DONE) ✅ DONE
These are the rules we want **enforced everywhere**. Current checkboxes reflect **actual enforcement today**.

Request ID: ✅ DONE
- [x] Library exists to read/generate request IDs
  - [x] Prefer incoming header: `x-request-id` / `x-correlation-id` / `x-amzn-trace-id`
  - [x] Else generate (crypto.randomUUID / randomUUID)
- [x] Success body: DO NOT include requestId (keep Gate 1 contract clean)

Logging: ✅ DONE
- [x] Structured JSON logger exists (`lib/log.ts`)
- [x] All API routes use structured logger (no `console.*`)
- [x] Logger redacts sensitive keys by default (password/session/invite token etc.)
- [x] Each emitted log line includes:
  - [x] `ts` (ISO string)
  - [x] `level`
  - [x] `msg`
  
---

### 2.1 New library files ✅ DONE
- [x] `lib/requestId.ts` exists
  - [x] `getOrCreateRequestId(req: Request): string`

- [x] `lib/log.ts` exists
  - [x] `log.debug/info/warn/error(...)` (structured JSON + redaction)

- [x] `lib/api/withRequestId.ts` exists
  - [x] wraps a handler and injects requestId + logger usage pattern


---

### 2.2 Gate 1 helper extensions ✅ DONE
- [x] `okNext` supports setting `x-request-id` when passed
- [x] `failNext` includes requestId in:
  - [x] response header `x-request-id` (when passed)
  - [x] error body `error.requestId` (when passed)

---

### 2.3 Migrate API routes (inventory) ✅ DONE

Rule for each API route (to mark [x]):
- Must create/propagate requestId at top
- Must use structured logging (no `console.*`)
- All error responses must include requestId (header + body)

### Admin routes ✅ DONE
- [x] app/api/admin/dashboard/route.ts
- [x] app/api/admin/invite/route.ts
- [x] app/api/admin/hours/route.ts
- [x] app/api/admin/hours/[id]/route.ts
- [x] app/api/admin/hours/[id]/approve/route.ts
- [x] app/api/admin/hours/[id]/reject/route.ts
- [x] app/api/admin/hours/[id]/delete/route.ts
- [x] app/api/admin/employees/route.ts
- [x] app/api/admin/employees/[id]/disable/route.ts
- [x] app/api/admin/projects/route.ts
- [x] app/api/admin/projects/[id]/route.ts
- [x] app/api/admin/projects/[id]/disable/route.ts

### Auth routes ✅ DONE
- [x] app/api/auth/signup/route.ts
- [x] app/api/auth/login/route.ts
- [x] app/api/auth/login/choose-company/route.ts
- [x] app/api/auth/me/route.ts
- [x] app/api/auth/logout/route.ts

### Onboarding routes ✅ DONE
- [x] app/api/onboarding/validate/route.ts
- [x] app/api/onboarding/complete/route.ts

### Employee routes ✅ DONE
- [x] app/api/employee/hours/route.ts
- [x] app/api/employee/hours/[id]/route.ts

### Root routes ✅ DONE
- [x] app/api/employees/route.ts
- [x] app/api/projects/route.ts
- [x] app/api/health/route.ts

---

### 2.4 Completion checks (must pass) ✅ DONE
- [x] Grep shows zero `console.` in `app/api/**`
- [x] Every `app/api/**/route.ts` is wrapped with requestId pattern
- [x] Every API error response contains `x-request-id` header + `error.requestId` body field

---

## Gate 3 — Runtime proof + Tests ⏳ In progress

### 3.1 Runtime RequestId proof (curl-level) ✅ Done
- [x] Success responses include `x-request-id` header
  - Proof command: `curl.exe -i http://localhost:3000/api/health`
- [x] Error responses include `x-request-id` header
  - Proof command: `curl.exe -i http://localhost:3000/api/admin/dashboard`
- [x] Error body includes `error.requestId`
  - Proof: response JSON contains `{ ok:false, error:{ requestId } }`

### 3.2 Contract tests (API response shape) ✅ Done
- [x] Unit tests cover `okNext` + `failNext` shape
  - ok: `{ ok:true, data }`
  - fail: `{ ok:false, error:{ code, message, requestId } }`
- [x] At least 1 test asserts `x-request-id` header is set when requestId is provided

### 3.3 Critical route tests (minimal but real)
- [x] Admin: GET /api/admin/dashboard returns 401 AUTH_REQUIRED + requestId

- [/] Auth
  - [/] login
    - [x] happy path
    - [x] wrong password → 401 INVALID_CREDENTIALS, no session cookie
    - [x] unknown email → 401 INVALID_CREDENTIALS, no session cookie
    - [ ] rate-limit / edge failures not tested
  - [x] logout
  - [x] choose-company happy path
  - [ ] signup not tested

- [/] Onboarding
  - [x] validate
    - [x] happy path
    - [x] expired token → 400 BAD_REQUEST
    - [x] invalid token → 404 NOT_FOUND
    - [x] missing token → 400 BAD_REQUEST
    - [x] token length invalid → 404 NOT_FOUND
    - [x] rate-limit → 429 RATE_LIMIT
  - [ ] complete
    - [ ] happy path
    - [ ] invalid/expired token
    - [ ] already active / already completed path (if applicable)

- [ ] Hours (pick minimum routes first)
  - [ ] employee: POST /api/employee/hours (create) happy path
  - [ ] employee: PATCH /api/employee/hours/[id] (update) happy path
  - [ ] admin: POST /api/admin/hours/[id]/approve happy path
  - [ ] admin: POST /api/admin/hours/[id]/reject happy path
  - [ ] admin: POST /api/admin/hours/[id]/delete happy path
  - [ ] one validation failure path (id invalid / forbidden / not found)

- [ ] Projects
  - [ ] admin: POST /api/admin/projects (create) happy path
  - [ ] admin: PATCH /api/admin/projects/[id] (update) happy path
  - [ ] admin: POST /api/admin/projects/[id]/disable happy path

- [ ] Employees
  - [ ] admin: POST /api/admin/invite happy path
  - [ ] legacy endpoint returns 410


### 3.4 Tenant isolation tests (killer checks)
- [ ] Cross-tenant access denied for:
  - hours by id
  - project by id
  - employee by id
- [ ] At least one test proves “same numeric id in another company” cannot be accessed

### 3.5 Rate limit tests (only core)
- [ ] `/api/auth/login` rate limits after threshold
- [ ] `/api/auth/signup` rate limits after threshold
- [ ] `/api/admin/invite` rate limits after threshold

### 3.6 Logging schema (target — not enforced yet)
- [ ] Standard log fields exist where emitted:
  - [ ] `requestId`
  - [ ] `route`
  - [ ] `companyId` (if available)
  - [ ] `statusCode` / `errorCode`


## Gate 4 — CI ⬜ NOT STARTED
- [ ] Install
- [ ] Lint
- [ ] Typecheck
- [ ] Test
- [ ] Build
- [ ] CI blocks main on failure

---

## Gate 5 — Minimum Safety ⬜ NOT STARTED
- [ ] Startup env validation
- [ ] Session cookie config verified
- [ ] Invite tokens never logged (prove via grep + logger redaction)
- [ ] `rejectUnauthorized:false` not used in prod

---

## CURRENT POSITION
- Gate 1: ✅ DONE
- Gate 2: ✅ DONE
- Gate 3: ⏳ IN PROGRESS
- Gate 4: ⬜
- Gate 5: ⬜
