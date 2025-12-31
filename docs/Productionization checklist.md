# CP Hours — V1 Production Checklist

## Gate 1 — API Contract Consistency

    Canonical API contract (locked)
    - Success: { ok: true, data: ... }
    - Error: { ok: false, error: { code, message } }

    Helpers (locked)
    - lib/api/response.ts → ok, fail
    - lib/api/nextResponse.ts → okNext, failNext

### Migrate ALL API routes to helpers (inventory from repo)
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

Contract enforcement checks (Gate 1 only)
- [x] No direct NextResponse.json in API routes

### Gate 1.2 — UI Consumers (API Contract Compliance)

Rule:
All frontend consumers must read API responses using:
- Success → `{ ok: true, data }`
- Error   → `{ ok: false, error: { code, message } }`

A file can be checked ONLY when **all API calls inside it** comply.

### Admin UI
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

### Employee UI
- [x] app/employee/page.tsx
  - GET `/api/auth/me`
  - GET `/api/projects`
  - GET `/api/employee/hours`
  - POST `/api/employee/hours`
  - PATCH `/api/employee/hours/[id]`
  - POST `/api/auth/logout`

### Auth / Onboarding UI
- [x] app/login/page.tsx
  - POST `/api/auth/login`
  - POST `/api/auth/login/choose-company`

- [x] app/signup/page.tsx
  - POST `/api/auth/signup`

- [x] app/onboarding/page.tsx
  - GET `/api/onboarding/validate`
  - POST `/api/onboarding/complete`
  - GET `/api/auth/me`

### Root
- [x] app/page.tsx
  - GET `/api/auth/me`

### Gate 1.2 completion rule
- [x] All UI consumers correctly handle `{ ok, data } / { ok, error }`




## Gate 2 — Request ID + Structured Logging (LOCKED)

Goal:
    Every API request gets a `requestId`, logs are structured and safe, and errors include `requestId`.

Non-negotiable scope:
- API routes only (`app/api/**/route.ts`)
- Logging utilities in `lib/`
- No refactors, no new features, no schema changes
- One file at a time: scan → list required changes → apply step-by-step
- Must not violate Gate 1 contract

---

### 2.0 Canonical rules (LOCKED)

Request ID:
- [x] Must be present for every request:
  - [x] Prefer incoming header: `x-request-id` if provided
  - [x] Else generate a new one
- [ ] Format: stable, URL-safe string
- [x] Must be returned to client in:
  - [x] Response header: `x-request-id`
  - [x] Error body: `{ ok:false, error:{ code, message }, requestId }`
  - [x] Success body: DO NOT include requestId (keep Gate 1 clean)

Logging:
- [x] All API logs must be JSON structured
- [ ] Each log line must include:
  - [x] `ts` (ISO string)
  - [x] `level` ("info" | "warn" | "error")
  - [ ] `requestId`
  - [ ] `route` (e.g. "POST /api/admin/invite")
  - [ ] `event` (short constant-like string)
  - [ ] optional `meta` (object)

Safety:
- [x] NEVER log:
  - [x] passwords
  - [x] session tokens / cookies
  - [x] invite tokens
  - [x] full request bodies by default
- [ ] Allowed meta fields:
  - [ ] companyId, employeeId, userId (if not sensitive)
  - [ ] statusCode
  - [ ] errorCode
  - [ ] durations (ms)
  - [ ] counts (e.g. rows)

---

## 2.1 New library files (LOCKED)

### A) lib/requestId.ts
- [x] `getOrCreateRequestId(req: Request): string`
  - [x] reads `x-request-id` if present
  - [x] else generates (crypto.randomUUID() or fallback)
- [ ] `withRequestIdHeaders(res: NextResponse, requestId: string): NextResponse`
  - sets header `x-request-id`

### B) lib/log.ts
- [ ] `logInfo(ctx, event, meta?)`
- [ ] `logWarn(ctx, event, meta?)`
- [ ] `logError(ctx, event, meta?)`
Where `ctx` includes:
- [ ] `requestId`
- [ ] `route` (string)
- [ ] optional ids: `companyId`, `employeeId`, `userId`

Implementation rules:
- [x] output single-line JSON via `console.log` / `console.error` (JSON string)
- [ ] never print raw Error objects; serialize safe fields only:
  - [ ] name, message, stack (stack optional, only server-side)
- [x] sanitize meta keys:
  - [x] drop keys matching /password|token|cookie|authorization/i

---

## 2.2 Gate 1 helper extensions (LOCKED) [x]

### Update helper(s) to include requestId on errors [x]
- [x] Update `failNext(code, message, status, requestId?)` to include:
  - [x] JSON: `{ ok:false, error:{code,message}, requestId }` when requestId provided
  - [x] Header: `x-request-id`
- [x] Update `fail(code, message, status, requestId?)` same behavior (non-NextResponse variant)
- [x] Success helpers remain unchanged (no requestId in body)

NOTE:
If helper signatures are currently locked in code, do minimal extension without breaking existing call sites.

---

## 2.3 Migrate API routes (inventory) [ ]

Rule for each API route:
- [x] Must create requestId at top
- [x] Must use structured logging (replace console.error/console.log)
- [x] All error responses must include requestId (header + body)

    ### Admin routes
    - [ ] app/api/admin/dashboard/route.ts
    - [ ] app/api/admin/invite/route.ts
    - [ ] app/api/admin/hours/route.ts
    - [ ] app/api/admin/hours/[id]/route.ts
    - [ ] app/api/admin/hours/[id]/approve/route.ts
    - [ ] app/api/admin/hours/[id]/reject/route.ts
    - [ ] app/api/admin/hours/[id]/delete/route.ts
    - [ ] app/api/admin/employees/route.ts
    - [ ] app/api/admin/employees/[id]/disable/route.ts
    - [ ] app/api/admin/projects/route.ts
    - [ ] app/api/admin/projects/[id]/route.ts
    - [ ] app/api/admin/projects/[id]/disable/route.ts

    ### Auth routes [x]
    - [x] app/api/auth/signup/route.ts
    - [x] app/api/auth/login/route.ts
    - [x] app/api/auth/login/choose-company/route.ts
    - [x] app/api/auth/me/route.ts
    - [x] app/api/auth/logout/route.ts

    ### Onboarding routes [x]
    - [x] app/api/onboarding/validate/route.ts
    - [x] app/api/onboarding/complete/route.ts

    ### Employee routes
    - [x] app/api/employee/hours/route.ts
    - [ ] app/api/employee/hours/[id]/route.ts

    ### Root routes
- [ ] app/api/employees/route.ts
- [ ] app/api/projects/route.ts
- [ ] app/api/health/route.ts

---

## 2.4 Completion checks (must pass)
- [ ] Every API response includes header `x-request-id`
- [ ] Every error body includes `requestId`
- [ ] No `console.error` left in `app/api/**/route.ts` (except inside lib/log.ts)
- [ ] No logs contain secrets (spot-check via ripgrep patterns)

STATUS: ⏳ IN PROGRESS

- [ ] Every API response includes header `x-request-id`
- [ ] Every error body includes `requestId`
- [ ] No `console.error` left in `app/api/**/route.ts` (except inside lib/log.ts)
- [ ] No logs contain secrets (spot-check via ripgrep patterns)

STATUS: ⬜ NOT STARTED / ⏳ IN PROGRESS / ✅ DONE

## Gate 3 — Tests
- [ ] Choose test framework (Vitest)
- [ ] Add test scripts to package.json

- [ ] Unit tests
  - [ ] time parsing
  - [ ] hour calculation
  - [ ] validation helpers
  - [ ] rate limit logic

- [ ] Integration tests
  - [ ] signup + login
  - [ ] invite + onboarding
  - [ ] hours create / approve

- [ ] npm test runs all tests

STATUS: ⬜ NOT STARTED / ⏳ IN PROGRESS / ✅ DONE

---

## Gate 4 — CI
- [ ] Add GitHub Actions workflow
- [ ] Install
- [ ] Lint
- [ ] Typecheck
- [ ] Test
- [ ] Build

- [ ] CI blocks main on failure

STATUS: ⬜ NOT STARTED / ⏳ IN PROGRESS / ✅ DONE

---

## Gate 5 — Minimum Safety
- [ ] Startup env validation
- [ ] Session cookie config verified
- [ ] Invite tokens never logged
- [ ] rejectUnauthorized:false not used in prod

STATUS: ⬜ NOT STARTED / ⏳ IN PROGRESS / ✅ DONE

---

## CURRENT POSITION
- Gate 1: ✅ DONE
- Gate 2: ⏳ IN PROGRESS
- Gate 3: ⬜
- Gate 4: ⬜
- Gate 5: ⬜
