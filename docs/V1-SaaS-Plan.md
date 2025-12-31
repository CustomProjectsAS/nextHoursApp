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

- Employee hours UI (V1-minimum):
  - create hour entry
  - edit PENDING / REJECTED
  - approved entries locked
  - project required

# Phase 0 — Baseline Decisions (Write once, no drifting) [x]
- [x] Create `V1.md` decisions summary (1 page max)
- [x] Roles locked: EMPLOYEE + ADMIN (+ OWNER if used)
- [x] Hours workflow locked (V1):
  - PENDING (submitted) → APPROVED or REJECTED → PENDING (resubmitted)
- [x] Employee edit rule (V1):
   - Employee can edit own entries while PENDING or REJECTED (not APPROVED)
- [x] Admin edit rule (V1):
  - Admin can edit PENDING/REJECTED; after admin edit entry becomes PENDING
- [x] Time calculation rule (V1):
  - Store workDate/fromTime/toTime/breakMinutes
  - Compute net/brut server-side (client cannot override)
  - Overnight shifts supported (toTime < fromTime)
  - V1: hoursBrut === hoursNet (no payroll rounding yet)


DONE means: decisions are written and agreed; no “we’ll see”.

---

# Phase 1 — Authentication (Email + Password + Session Cookie) ✅ LOCKED [/]
## Decisions (locked)
- Auth = Email + password
- If email exists in multiple companies → user selects company after password verification (rare case)
- Employee email unique per company: @@unique([companyId, email])
- Session stored server-side, cookie is HttpOnly

## Work items
### 1.1 Schema [x]
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

### 1.2 Cookies (spec) [x]
- [x] Cookie name: `cph_session`
- [x] HttpOnly = true
- [x] Secure = true in production
- [x] SameSite = Lax
- [x] Path = /
- [x] Max-Age matches expiresAt (e.g. 30 days)

### 1.3 Endpoints [x]
- [x] `POST /api/auth/signup`
  - creates Company + OWNER + Session cookie
- [x] `POST /api/auth/login`
  - email + password
  - if multiple matches → return companies list to pick
- [x] `POST /api/auth/login/choose-company` (only if needed)
  - creates session for selected company employee row
- [x] `POST /api/auth/logout`
  - revoke session + clear cookie
- [x] `GET /api/auth/me`
  - returns { employeeId, companyId, role, name, companyName }

### 1.4 UI pages [x]
- [x] `/signup`
- [x] `/login`
- [x] Remove query-param identity use (no token-based identity for app usage)


DONE means: app identity comes only from session cookie; no client-sent employeeId for “who I am”.

### 1.5 Multi-company login behavior (V1) [ ]
- [ ] If the same email exists in multiple companies, `POST /api/auth/login` must:
  - verify password first
  - only then return a choose-company response
  - never leak company info on wrong password
- [ ] V1 constraint explicitly documented:
  - credentials are Employee-scoped (`Employee.passwordHash`)
  - multi-company access assumes the same password is set for each Employee row
  - this constraint is temporary and resolved in Phase 9 (Global User identity)
- [ ] Manual verification recorded:
  - same email exists in 2 companies
  - login returns choose-company
  - wrong password returns generic auth error only

---


# Phase 2 — Tenant Isolation (Code + DB Guardrails) ✅ LOCKED[x]
## Decisions (locked)
- Isolation enforced via code checks + DB constraints where possible
- Every request runs under ctx = { companyId, employeeId, role } derived from session

## Work items
### 2.1 Schema
- [x] Ensure `companyId` exists on:
  - Employee
  - Project
  - HourEntry
  - ActivityEvent
- [ ] Composite unique:
  - [x] Employee: @@unique([companyId, email])
  - [ ] Optional: Project: @@unique([companyId, name])
- [ ] Indexes (recommended V1):
  - [x] HourEntry: @@index([companyId, workDate])
  - [x] HourEntry: @@index([companyId, employeeId, workDate])
  - [ ] Project: @@index([companyId, isActive])
  
### 2.2 API hard rules [x]
- [x] Create `getAuthContext()` helper (reads cookie → loads session → returns ctx)
- [x] Every read query includes `where: { companyId: ctx.companyId }`
- [x] Every write validates referenced entities belong to ctx.companyId
- [x] For employee routes: enforce self access (employeeId = ctx.employeeId)
- [x] EmployeeId filters must be validated to belong to ctx.companyId (implemented in /api/admin/hours)

### 2.3 Kill global leaks [x]
- [x] Remove/replace global list endpoints (e.g. `/api/employees` returning all active)
- [x] Replace with scoped endpoints:
  - `/api/admin/employees` (company-only)
  - `/api/projects` (company-only)

### 2.4 Tenant leak test (manual V1)[x]
- [x] Try to access another company’s employee/project/hour by ID → must 404/403
- [x] Verify list endpoints only return own company rows

DONE means: Company A cannot read/write any Company B data, even if IDs are guessed.
- [x] Attempt cross-tenant access on a mutation route (approve/reject/delete) with other id → must 404/403
---





# Phase 3 — Self-serve Onboarding (Company → Owner → Invites) ✅ LOCKED[x]
## Decisions (locked)
- Self-serve signup creates company + owner immediately
- Invites are single-use and expire
- Employee activation sets password and creates session

## Work items
### 3.1 Signup (Owner creation) [x]
- [x] `POST /api/auth/signup` creates:
  - Company
  - Employee(OWNER) ACTIVE with passwordHash
  - Session cookie
- [x] Redirect to `/admin`

### 3.2 Invites ✅ (hash-only, single-use) [x]

#### 3.2.1 Invite token security (hash-only) [x]
- [x] Server generates a raw invite token ONLY to return once (never stored raw)
- [x] Store only `Employee.inviteTokenHash` (sha256) in DB
- [x] Enforce expiry via `Employee.inviteExpiresAt`
- [x] Enforce single-use by clearing `inviteTokenHash` + `inviteExpiresAt` on successful onboarding

#### 3.2.2 Admin invite endpoint [x]
- [x] `POST /api/admin/invite`
  - [x] creates Employee INVITED
  - [x] sets `inviteTokenHash` + `inviteExpiresAt`
  - [x] returns inviteUrl `/onboarding?token=<RAW_TOKEN>` (copy-link OK for V1)

#### 3.2.3 Onboarding endpoints (hash-only lookup) [x]
- [x] `GET /api/onboarding/validate?token=...`
  - [x] looks up by `inviteTokenHash` ONLY
  - [x] returns companyName + status only (no PII)
- [x] `POST /api/onboarding/complete`
  - [x] looks up by `inviteTokenHash` ONLY
  - [x] sets passwordHash, status ACTIVE
  - [x] clears `inviteTokenHash` + `inviteExpiresAt`
  - [x] creates session cookie
  - [x] returns `{ ok: true }` (no PII)

#### 3.2.4 Transition closure (remove legacy + drop deprecated storage) [x]
- [x] Disable legacy invite endpoints (no raw token writers)
- [x] Remove fallback reads that accept legacy raw tokens
- [x] Drop deprecated DB column `Employee.inviteToken` via Prisma migration



### 3.3 UI pages (activation flow) [x]

- [x] Create page: /onboarding?token=... (activation only)
- [x] On page load, call GET /api/onboarding/validate?token=...
  - [x] Show companyName ONLY (no PII)
  - [x] If invalid/expired/used → show final error state (no retry loop)
- [x] Activation form:
  - [x] password + confirmPassword fields
  - [x] Submit to POST /api/onboarding/complete with token + password
  - [x] On success: session cookie is set by server
- [x] After activation, user is redirected using role landing:
  - [x] EMPLOYEE → /employee
  - [x] ADMIN / OWNER → /admin
- [x] Manual verification recorded:
  - [x] Invite link opens onboarding page
  - [x] Activation succeeds and user lands correctly
  - [x] Same invite link reused fails (single-use enforced)

DONE means: real company can start and invite employees without touching DB.

---

# Phase 4 — Hours Core Flow ✅ LOCKED[/]
## Decisions (locked)
- Employee can edit own entries until approved
- Admin can approve/reject, edit SUBMITTED/REJECTED
- All identity derived server-side

## Work items
### 4.1 Employee endpoints[x]
- [x] `GET /api/employee/hours?month=YYYY-MM` (scoped to ctx.employeeId + ctx.companyId)
- [x] `POST /api/employee/hours` (no employeeId in body)
- [x] `PATCH /api/employee/hours/:id` allowed only if status != APPROVED and belongs to ctx

### 4.2 Admin endpoints[x]
- [x] `GET /api/admin/hours?month=YYYY-MM&status=...&employeeId=...` (company scope)
- [x] `PATCH /api/admin/hours/:id` (edit; sets status PENDING)
- [x] `POST /api/admin/hours/:id/approve`
- [x] `POST /api/admin/hours/:id/reject` (requires rejectReason)

### 4.3 Calculation + validation[x]
- [x] Server computes hoursNet/hoursBrut
- [x] Overnight shifts supported
- [x] Reject invalid time ranges/breaks with clear errors

### 4.4 UI requirements (V1)
- [x] Employee: submit hours + see status + see rejection reason
- [ ] Admin: filter by month + status; approve/reject/edit without full reload
  - [ ] Remove `window.location.reload()` usage for core flows


DONE means: employee→admin→approve/reject loop works cleanly.

---

# Phase 4.5 — Admin UI Shell (V1) ✅ LOCKED [x]
## Decisions (locked)
- Admin landing is a simple 4-tile dashboard (no tables/spreadsheets)
- Timeline is an admin load/overview tool (who worked when / together)
- V1 timeline view: Day only (Week/Month deferred)

## Work items
### 4.5.1 Admin dashboard metrics [x]
- [x] `GET /api/admin/dashboard` returns:
  - hoursPendingCount
  - hoursRejectedCount
  - activeEmployeesCount
  - activeProjectsCount

### 4.5.2 Admin landing page [x]
- [x] `/admin` shows 4 tiles:
  - Hours (pending + rejected; highlights when pending > 0)
  - Timeline (entry point)
  - Employees (active count)
  - Projects (active count)

### 4.5.3 Admin routes wired [x]
- [x] `/admin/hours`
- [x] `/admin/timeline`
- [x] `/admin/employees` (placeholder OK for now)
- [x] `/admin/projects` (placeholder OK for now)

### 4.5.4 Admin timeline (clean V1) [x]
- [x] Prototype timeline code discarded (no patching)
- [x] Timeline view is stable (defensive against missing entries)
- [x] Day view navigation (prev / today / next)

DONE means: admin can land, see key counts, and reach Hours/Timeline without errors.

---

# Phase 4.6 — Employee Hours UI (V1-minimum) ✅ LOCKED[/]
## Goal
Employee can submit hours correctly; admin can review; rules enforced; no spreadsheet UX.

## Work items
### 4.6.1 Employee create hour entry [x]
- [x] Create entry flow works end-to-end
- [x] Project is required (cannot submit without)
- [x] Validation errors are clear

### 4.6.2 Employee edit rules [/]
- [ ] Employee can edit entries with status PENDING or REJECTED
- [ ] Employee cannot edit APPROVED entries (locked)

### 4.6.3 Employee list UX [/]
- [ ] Show current month by default
- [ ] Status visible per entry
- [ ] “Approved = locked” visibly communicated

### 4.6.4 Admin review UX (V1-minimum) [/]
- [ ] Admin can see pending/rejected entries
- [ ] Approve / reject actions available
- [ ] Approved entries become immutable

DONE means: the employee hours experience is usable without training and cannot violate rules.

---

# Phase 5 — Audit Trail (Full before/after) ✅ LOCKED[/]
## Decisions (locked)
- Log every important mutation with before/after (bulletproof)

## Work items
### 5.1 ActivityEvent model[x]
- [x] Fields:
  - companyId
  actorType (EMPLOYEE | ADMIN | OWNER | SYSTEM)
  - actorId (nullable)
  - actorName (nullable snapshot)
  - entityType (e.g. HOUR_ENTRY)
  - entityId (nullable)
  - eventType (enum)
  - summary (optional human readable line)
  - meta (JsonB: structured payload like prev/next/reason/diff)

### 5.2 Logging coverage (minimum)[x]
- [x] HourEntry: create/edit/approve/reject/delete events logged (see checks below)
- [x] Employee: invite/activate/disable
- [x] Project: create/update/disable
- [x] (Optional V1) Auth: login/logout events
        logs LOGIN + LOGOUT into ActivityEvent (entityType=AUTH, entityId=null)
- [x] Approve logged (ActivityEvent eventType = HOUR_APPROVED)
- [x] Reject logged (ActivityEvent eventType = HOUR_REJECTED, includes rejectReason)
- [x] Admin edit logged (ActivityEvent eventType = HOUR_EDITED, includes prev/next + changed fields)
- [x] Soft delete logged (ActivityEvent eventType = HOUR_DELETED; HourEntry.deletedAt set)



### 5.3 Admin view
- [ ] Read-only activity list page for admins

DONE means: you can answer “who changed what and when” reliably.

---

# Phase 6 — Hardening (Zod + Standards) ✅ LOCKED[/]
## Decisions (locked)
- Zod validation everywhere
- Standard API response shape
- Rate limit auth/onboarding

## Work items [/]
- [ ] Zod schemas for every route input (params/query/body) (post-V1 hardening)
- [x] standardize errors across auth routes.
- [x] Unified error format:
  - ok: false
  - error: { code, message, details? }
- [x] Rate limit:
  - [x] signup
  - [x] login
  - [x] login/choose-company
  - [x] admin invite
  - [x] onboarding validate
  - [x] onboarding complete 
- [x] Debug routes disabled (removed from codebase)
    - NOTE: Current environment is experimental; hard infra separation will be done before any real production deployment
- [x] No stack traces returned to client


DONE means: predictable errors, resilient endpoints, fewer production surprises.

---
## Transition Closure Checklist (required after any refactor/migration) [x]
- [x] Identify legacy writers (endpoints that still write deprecated fields)
- [x] Disable/delete legacy writers
- [x] Remove fallback reads (stop accepting deprecated formats)
- [x] Remove deprecated field usage from code (search must show zero hits in app/)
- [x] Drop deprecated DB columns via migration
- [x] `npm run build` passes

# Phase 7 — Deployment (Single EU Region) ✅ LOCKED [x]
## Decisions (locked)
- Single region EU deployment (Scandinavia/Baltics target)
- Stateless servers; sessions in DB

## Work items
- [x] 7.1 `.env.example` with required vars:
  - DATABASE_URL
  - AUTH_SECRET
  - APP_URL
  - NEXT_PUBLIC_APP_URL
  - NODE_ENV

- [x] 7.2`/api/health` returns:
  - version
  - db ok
  - timestamp
- [x] 7.3 Migration strategy documented:
  - run migrations on deploy
  - avoid destructive migrations unless intentional
- [x] 7.4 Logging strategy: meaningful server logs for core flows

DONE means: repeatable deployments and clear operational visibility.

---

# Phase 8 — Legal Minimum (Templates for V1) ✅ LOCKED [x]
## Decisions (locked)
- Templates now, lawyer later

## Work items
- [x] `/privacy`
- [x] `/terms`
- [x] `/dpa` (basic DPA-lite)
- [x] Footer links in app
- [x] Manual process defined for data export/deletion requests

DONE means: you can onboard real customers without looking sketchy.

---


# Phase 9 — Global Identity (User model) (Post-V1)[/]

## Decisions (locked)
- Introduce global `User` identity where `User.email` is globally unique
- `Employee` becomes a company-scoped membership/role that links `userId + companyId`
- Same User can be Employee in multiple companies
- Sessions remain bound to { employeeId, companyId } (tenant isolation stays intact)

## Work items
### 9.1 Schema (transitional)
- [x] Add `User` table (email @unique)
- [x] Add nullable `Employee.userId`
- [x] Backfill: create Users from existing Employee.email and link Employee.userId
- [ ] Make `Employee.userId` required
- [ ] Remove `Employee.email`
- [ ] Update unique constraint to `@@unique([companyId, userId])`

### 9.2 Auth refactor
- [x] Login authenticates via `User.email + passwordHash` before loading any company data (no company info leak)
- [ ] If same User has multiple Employee rows → keep choose-company flow
- [ ] Password reset will target User (future)

### 9.3 Signup rule
- [ ] Signup creates:
  - User (if not exists)
  - Company
  - Employee(role=OWNER)
- [ ] Decide whether one User can own multiple companies via signup (allowed/blocked)
- [ ] Signup enforces BLOCK (409 on existing `User.email`)
- [ ] Signup creates `User` + `Employee.userId` link


DONE means: owner email uniqueness is enforced globally without breaking multi-company employees.

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

---
