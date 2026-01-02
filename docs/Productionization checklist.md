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

## Gate 3 — Runtime proof + Tests ⏳ In progress ✅ Done

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

### 3.3 Critical route tests (minimal but real) ✅ Done
- [x] Admin: GET /api/admin/dashboard returns 401 AUTH_REQUIRED + requestId

- [x] Auth
  - [x] login
    - [x] happy path
    - [x] wrong password → 401 INVALID_CREDENTIALS, no session cookie
    - [x] unknown email → 401 INVALID_CREDENTIALS, no session cookie
    - [x] rate-limit / edge failures not tested
  - [x] logout
  - [x] choose-company happy path
  - [x] signup tested (happy path + duplicate email + rate limit)
  

- [x] Onboarding
  - [x] validate
    - [x] happy path
    - [x] expired token → 400 BAD_REQUEST
    - [x] invalid token → 404 NOT_FOUND
    - [x] missing token → 400 BAD_REQUEST
    - [x] token length invalid → 404 NOT_FOUND
    - [x] rate-limit → 429 RATE_LIMIT
  - [x] complete
    - [x] happy path
    - [x] invalid/expired token
    - [x] already active / already completed path (if applicable)

- [x] Hours (pick minimum routes first)
  - [x] employee: POST /api/employee/hours (create) happy path
  - [x] employee: PATCH /api/employee/hours/[id] (update) happy path
  - [x] employee: DELETE /api/employee/hours/[id] (delete) happy path (PENDING only)
  - [x] admin: POST /api/admin/hours/[id]/approve happy path
  - [x] admin: POST /api/admin/hours/[id]/reject happy path
  - [x] admin: POST /api/admin/hours/[id]/delete happy path
  - [x] one validation failure path (id invalid / forbidden / not found) only forbidden

- [x] Projects
  - [x] admin: POST /api/admin/projects (create) happy path
  - [x] admin: PATCH /api/admin/projects/[id] (update) happy path
  - [x] admin: POST /api/admin/projects/[id]/disable happy path

- [x] Employees
  - [x] admin: POST /api/admin/invite happy path
  - [x] legacy endpoint returns 410


### 3.4 Tenant isolation tests (killer checks) ✅ Done
Goal: prove cross-tenant access is impossible at the handler level. These tests are minimal but catastrophic-risk destroying.

Rules (every 3.4 test must assert ALL):
- HTTP status
- canonical response contract ({ ok } shape)
- x-request-id header present
- error.requestId equals x-request-id (for error responses)
- no cross-tenant DB mutation
- no activityEvent/audit row when the route normally writes one

- [x] Cross-tenant ID access denied (WRITE routes)
  - [x] employee: PATCH /api/employee/hours/[id]
        - setup: create hour entry in Company A
        - action: Company B session attempts PATCH using Company A entry id
        - expect: 404 NOT_FOUND (preferred) or 403 FORBIDDEN (if repo standard)
        - prove: DB row unchanged + no audit row created
  - [x] admin: POST /api/admin/hours/[id]/approve
        - setup: create PENDING hour entry in Company A
        - action: Company B admin session attempts approve using Company A entry id
        - expect: 404 NOT_FOUND or 403 FORBIDDEN
        - prove: status remains PENDING + no activityEvent created

- [x] Cross-tenant ID access denied (READ/list route)
  - [x] admin: GET /api/admin/projects
        - setup: create projects in Company A and Company B
        - action: Company A admin calls GET
        - expect: response contains only Company A project ids (explicitly assert foreign ids absent)

[x] Same numeric id collision proof (explicit)
  Goal: prove we never accidentally rely on “id uniqueness across tenants”.
  Rule: the handler MUST enforce tenant isolation via companyId (or equivalent) and the test MUST simulate “same-looking ids”.

  - [x] Required test shape (must include ALL 3):
    - [x] Setup: create Company A + Company B
    - [x] Setup: create at least one entity in EACH company (so ids exist on both sides)
    - [x] Action: use Company B session to access/mutate Company A entity using Company A numeric id
    - [x] Expect: denied (404 NOT_FOUND preferred), AND:
      - [x] response contract asserted
      - [x] x-request-id present (+ error.requestId matches when error)
      - [x] no cross-tenant DB mutation
      - [x] no activityEvent/audit row when route normally writes one

  - [x] Minimum coverage requirement:
    - [x] One WRITE route (employee or admin mutation) uses this pattern
    - [x] One READ route (list or detail) uses this pattern OR explicitly justified why list route can’t apply



### 3.5 Rate limit tests (core + deterministic) ✅ Done
Goal: prove rate limiting is real, deterministic, and cannot create side effects when blocked.

Global rules (apply to every 3.5 test):
- Tests MUST be deterministic:
  - Either use a unique key per test (recommended), OR reset limiter state between tests.
- Every rate-limit response MUST assert:
  - status 429
  - error.code = RATE_LIMIT
  - x-request-id header present
  - error.requestId matches x-request-id
  - Retry-After header present (if implemented in route)
- “No side effects” rule:
  - A 429 request must not create new DB rows and must not mutate existing rows.

- [x] `/api/auth/login` rate limits after threshold
  - [x] Trigger 429 deterministically (unique limiter key for the test)
  - [x] Assert 429 + RATE_LIMIT + requestId + (Retry-After if present)
  - [x] Assert no session created for the 429 attempt
  - [x] Assert no AuthEvent (or equivalent audit row) created for the 429 attempt (if route writes one)

- [x] `/api/auth/signup` rate limits after threshold
  - [x] Trigger 429 deterministically (unique limiter key for the test)
  - [x] Assert 429 + RATE_LIMIT + requestId + Retry-After (if present)
  - [x] Assert “429 attempt creates NO extra rows”:
    - [x] Compare counts taken immediately BEFORE the 429 request vs AFTER it for:
      - [x] user
      - [x] company
      - [x] employee
      - [x] session (if applicable)
  - [x] Assert no “success” logs/audit rows are written for the 429 attempt (if route writes any)
  - Justification: signup route does not write audit rows; SIGNUP_OK is only emitted after successful transaction

- [x] `/api/admin/invite` rate limits after threshold
  - [x] Trigger 429 deterministically (unique limiter key for the test)
  - [x] Assert 429 + RATE_LIMIT + requestId + Retry-After (if present)
  - [x] Assert no invite created / no employee created / no auth event created on 429
 


### 3.6 Logging schema (enforced, not aspirational) ✅ Done
Goal: logs are structured, consistent, and safe — not “whatever the dev felt like today”.

Rules:
- No console.* in app/api/** (already a Gate 2 invariant)
- All API routes MUST emit structured logs with a predictable ctx schema.
- Logging must never leak secrets (passwords, session tokens, invite tokens, raw auth headers).

Required fields:
- requestId (always)
- route (always, stable string e.g. "POST /api/admin/hours/[id]/approve")
- companyId (when ctx exists)
- employeeId (when ctx exists)
- statusCode OR errorCode (at least one per request outcome)

Enforcement (must be test-proven):
- [x] Unit test: logger output is JSON and includes required top-level keys (ts, level, message/msg, ctx)
- [x] Unit test: ctx includes requestId + route for at least one representative API log call
- [x] Unit test: redaction works (known sensitive keys are replaced/removed)
- [x] API-route test: at least one route emits a warn/error log with ctx containing:
  - requestId
  - route
  - (companyId when authenticated)
  - errorCode on failure

Completion rule:
- Mark this section [x] ONLY when the tests exist and pass in CI, not when “we usually include these fields”.


## Gate 4 — CI ⬜ NOT STARTED
Goal: CI is the enforcement mechanism. If CI is green, main is safe. If CI is red, main is blocked.

### CI workflow requirements (test-proven by running in GitHub Actions)
- [x] GitHub Actions workflow exists at `.github/workflows/ci.yml`
- [x] Triggers: push to main + pull_request
- [x] Node pinned (e.g. 20.x)
- [x] Install uses `npm ci` (lockfile is authoritative)
- [x] Cache npm for speed (optional but recommended)

### Database requirements (non-negotiable)
- [x] CI uses a local Postgres service container (NOT Render / remote)
- [x] `DATABASE_URL` points to CI Postgres with `sslmode=disable`
- [x] Prisma is prepared before tests:
  - [x] `npx prisma generate`
  - [x] `npx prisma migrate deploy` (or `db push` if explicitly chosen)

### Required checks (must all pass)
- [x] Typecheck: `npm run typecheck`
- [x] Tests (local DB): `npm run test:local`
- [x] Build: `npm run build`
- [ ] Lint: `npm run lint` (only if lint is actually enforced)

### Branch protection (blocks main)
- [x] Require CI checks to pass before merging
- [x] Disallow merge when checks fail


## Gate 5 — Minimum Safety ⬜ NOT STARTED
- [ ] Startup env validation
- [ ] Session cookie config verified
- [ ] Invite tokens never logged (prove via grep + logger redaction)
- [ ] `rejectUnauthorized:false` not used in prod

---

## CURRENT POSITION
- Gate 1: ✅ DONE
- Gate 2: ✅ DONE
- Gate 3: ✅ DONE
- Gate 4: ⏳ IN PROGRESS
- Gate 5: ⬜
