# CP Hours — V1 SaaS Execution Plan (Checkbox Plan)

## Purpose
Build a real B2B SaaS Hours app for shift-based companies (5–100 employees) with:
- Simple, fast hour registration
- High trust for admins
- Minimal friction for employees
- Production-ready SaaS (not a demo)

## V1 Principles (locked)
- Boring but reliable > clever
- Server is source of truth (identity + company scope)
- No cross-company data access
- One step at a time (discuss → agree → implement)

## V1 Non-goals (locked)
- No billing/subscriptions
- No advanced timeline drag/stretch input
- No multi-region
- No “fake simplicity” hidden rules

---

# Phase 0 — Baseline Decisions (Write once, no drifting)
- [x] Create `V1.md` decisions summary (1 page max)
- [x] Roles locked: EMPLOYEE + ADMIN (+ OWNER if used)
- [x] Hours workflow locked (V1):
  - PENDING (submitted) → APPROVED or REJECTED → PENDING (resubmitted)
- [x] Employee edit rule (V1):
   - Employee can edit own entries while PENDING or REJECTED (not APPROVED)
- [x] Admin edit rule (V1):
  - Admin can edit PENDING/REJECTED; after admin edit entry becomes PENDING
- [ ] Time calculation rule (V1):
  - Store workDate/fromTime/toTime/breakMinutes; compute net/brut server-side
  - Overnight shifts supported (toTime < fromTime = next day)

DONE means: decisions are written and agreed; no “we’ll see”.

---

# Phase 1 — Authentication (Email + Password + Session Cookie) ✅ LOCKED
## Decisions (locked)
- Auth = Email + password
- If email exists in multiple companies → user selects company after password verification (rare case)
- Employee email unique per company: @@unique([companyId, email])
- Session stored server-side, cookie is HttpOnly

## Work items
### 1.1 Schema
- [x] Add `Employee.passwordHash` (nullable until set)
- [x] Add `Session` model:
  - id
  - tokenHash (store hash only)
  - employeeId (FK)
  - companyId (FK or stored for speed)
  - createdAt
  - expiresAt
  - revokedAt (nullable)
  - lastUsedAt (nullable)
  - ip (nullable, optional)
  - userAgent (nullable, optional)

### 1.2 Cookies (spec)
- [ ] Cookie name: `cph_session`
- [ ] HttpOnly = true
- [ ] Secure = true in production
- [ ] SameSite = Lax
- [ ] Path = /
- [ ] Max-Age matches expiresAt (e.g. 30 days)

### 1.3 Endpoints
- [ ] `POST /api/auth/signup`
  - creates Company + OWNER + Session cookie
- [ ] `POST /api/auth/login`
  - email + password
  - if multiple matches → return companies list to pick
- [ ] `POST /api/auth/login/choose-company` (only if needed)
  - creates session for selected company employee row
- [ ] `POST /api/auth/logout`
  - revoke session + clear cookie
- [x] `GET /api/auth/me`
  - returns { employeeId, companyId, role, name, companyName }

### 1.4 UI pages
- [ ] `/signup`
- [ ] `/login`
- [ ] Remove query-param identity use (no token-based identity for app usage)

DONE means: app identity comes only from session cookie; no client-sent employeeId for “who I am”.

---

# Phase 2 — Tenant Isolation (Code + DB Guardrails) ✅ LOCKED
## Decisions (locked)
- Isolation enforced via code checks + DB constraints where possible
- Every request runs under ctx = { companyId, employeeId, role } derived from session

## Work items
### 2.1 Schema
- [ ] Ensure `companyId` exists on:
  - Employee
  - Project
  - HourEntry
  - ActivityEvent
- [ ] Composite unique:
  - [ ] Employee: @@unique([companyId, email])
  - [ ] Optional: Project: @@unique([companyId, name])
- [ ] Indexes (recommended V1):
  - [ ] HourEntry: @@index([companyId, workDate])
  - [ ] HourEntry: @@index([companyId, employeeId, workDate])
  - [ ] Project: @@index([companyId, isActive])

### 2.2 API hard rules
- [ ] Create `getAuthContext()` helper (reads cookie → loads session → returns ctx)
- [ ] Every read query includes `where: { companyId: ctx.companyId }`
- [ ] Every write validates referenced entities belong to ctx.companyId
- [ ] For employee routes: enforce self access (employeeId = ctx.employeeId)

### 2.3 Kill global leaks
- [ ] Remove/replace global list endpoints (e.g. `/api/employees` returning all active)
- [ ] Replace with scoped endpoints:
  - `/api/admin/employees` (company-only)
  - `/api/projects` (company-only)

### 2.4 Tenant leak test (manual V1)
- [ ] Try to access another company’s employee/project/hour by ID → must 404/403
- [ ] Verify list endpoints only return own company rows

DONE means: Company A cannot read/write any Company B data, even if IDs are guessed.

---

# Phase 3 — Self-serve Onboarding (Company → Owner → Invites) ✅ LOCKED
## Decisions (locked)
- Self-serve signup creates company + owner immediately
- Invites are single-use and expire
- Employee activation sets password and creates session

## Work items
### 3.1 Signup (Owner creation)
- [ ] `POST /api/auth/signup` creates:
  - Company
  - Employee(OWNER) ACTIVE with passwordHash
  - Session cookie
- [ ] Redirect to `/admin`

### 3.2 Invites
- [ ] `POST /api/admin/invite`
  - creates Employee INVITED with inviteToken + inviteExpiresAt
  - generate invite link (email sending optional; copy link OK for V1)
- [ ] `GET /api/onboarding/validate?token=...`
  - returns employee + company name for onboarding UI only
- [ ] `POST /api/onboarding/complete`
  - sets name (if missing), sets passwordHash, status ACTIVE
  - invalidates inviteToken + inviteExpiresAt
  - creates session cookie
  - redirects to `/employee`

### 3.3 UI pages
- [ ] `/onboarding?token=...` only for activation
- [ ] After activation: normal login flow (session based)

DONE means: real company can start and invite employees without you touching DB.

---

# Phase 4 — Hours Core Flow ✅ LOCKED
## Decisions (locked)
- Employee can edit own entries until approved
- Admin can approve/reject, edit SUBMITTED/REJECTED
- All identity derived server-side

## Work items
### 4.1 Employee endpoints
- [ ] `GET /api/employee/hours?month=YYYY-MM` (scoped to ctx.employeeId + ctx.companyId)
- [ ] `POST /api/employee/hours` (no employeeId in body)
- [ ] `PATCH /api/employee/hours/:id` allowed only if status != APPROVED and belongs to ctx

### 4.2 Admin endpoints
- [ ] `GET /api/admin/hours?month=YYYY-MM&status=...&employeeId=...` (company scope)
- [ ] `PATCH /api/admin/hours/:id` (edit; sets status SUBMITTED)
- [ ] `POST /api/admin/hours/:id/approve`
- [ ] `POST /api/admin/hours/:id/reject` (requires rejectReason)

### 4.3 Calculation + validation
- [ ] Server computes hoursNet/hoursBrut
- [ ] Overnight shifts supported
- [ ] Reject invalid time ranges/breaks with clear errors

### 4.4 UI requirements (V1)
- [ ] Employee: submit hours + see status + see rejection reason
- [ ] Admin: filter by month + status; approve/reject/edit without full reload

DONE means: employee→admin→approve/reject loop works cleanly.

---

# Phase 5 — Audit Trail (Full before/after) ✅ LOCKED
## Decisions (locked)
- Log every important mutation with before/after (bulletproof)

## Work items
### 5.1 ActivityEvent model
- [ ] Fields:
  - companyId
  - actorEmployeeId (nullable for SYSTEM)
  - entityType
  - entityId
  - action
  - before (JSON nullable)
  - after (JSON nullable)
  - createdAt

### 5.2 Logging coverage (minimum)
- [ ] HourEntry: create/update/approve/reject
- [ ] Employee: invite/activate/disable
- [ ] Project: create/update/disable
- [ ] (Optional V1) Auth: login/logout events

### 5.3 Admin view
- [ ] Read-only activity list page for admins

DONE means: you can answer “who changed what and when” reliably.

---

# Phase 6 — Hardening (Zod + Standards) ✅ LOCKED
## Decisions (locked)
- Zod validation everywhere
- Standard API response shape
- Rate limit auth/onboarding

## Work items
- [ ] Zod schemas for every route input (params/query/body)
- [ ] Unified error format:
  - ok: false
  - error: { code, message, details? }
- [ ] Rate limit:
  - signup
  - login
  - invite
  - onboarding validate/complete
- [ ] Disable debug routes in production
- [ ] No stack traces returned to client
- [ ] Remove `window.location.reload()` usage for core flows

DONE means: predictable errors, resilient endpoints, fewer production surprises.

---

# Phase 7 — Deployment (Single EU Region) ✅ LOCKED
## Decisions (locked)
- Single region EU deployment (Scandinavia/Baltics target)
- Stateless servers; sessions in DB

## Work items
- [ ] `.env.example` with required vars:
  - DATABASE_URL
  - SESSION_SECRET
  - BASE_URL
  - NODE_ENV
- [ ] `/api/health` returns:
  - version
  - db ok
  - timestamp
- [ ] Migration strategy documented:
  - run migrations on deploy
  - avoid destructive migrations unless intentional
- [ ] Logging strategy: meaningful server logs for core flows

DONE means: repeatable deployments and clear operational visibility.

---

# Phase 8 — Legal Minimum (Templates for V1) ✅ LOCKED
## Decisions (locked)
- Templates now, lawyer later

## Work items
- [ ] `/privacy`
- [ ] `/terms`
- [ ] `/dpa` (basic DPA-lite)
- [ ] Footer links in app
- [ ] Manual process defined for data export/deletion requests

DONE means: you can onboard real customers without looking sketchy.

---

# V1 READY — Hard Stop Definition
V1 is ready only when ALL are true:
- [ ] Self-serve signup creates company + owner and logs in
- [ ] Employee can log in (session cookie auth)
- [ ] Admin can invite employee; employee can onboard and set password
- [ ] Employee can submit/edit hours (until approved)
- [ ] Admin can approve/reject with reason and edit rules enforced
- [ ] Tenant isolation proven (no leaks)
- [ ] Full audit logging implemented for core mutations
- [ ] Zod validation + consistent errors across APIs
- [ ] Deployment is repeatable (env + migrations + health)
- [ ] Legal pages exist and are linked
