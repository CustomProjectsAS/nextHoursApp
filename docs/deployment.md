# Deployment & Migrations (V1)

## Goals
- Repeatable deploys
- Database schema is always in sync with code
- No destructive surprises

## Environments
- Local dev: `prisma migrate dev`
- Production: `prisma migrate deploy`

## Migration rules (V1)
1. **Never** use `prisma db push` in production.
2. All schema changes must be committed as Prisma migrations.
3. Production deploy must run migrations **before** serving traffic.
4. Avoid destructive migrations by default:
   - dropping columns/tables is allowed only when explicitly intended and verified
5. If a destructive change is needed:
   - ship code that stops reading/writing the field first
   - deploy
   - then ship a migration that drops the field
   - deploy again

## Production deploy sequence
1. Build app
2. Run `prisma migrate deploy`
3. Start server
4. Verify `/api/health` returns `{ ok: true, db: { ok: true } }`

## Rollback note
- Prisma migrations are forward-only.
- Rollback means deploying the previous app version **only if schema remains compatible**.
- For risky changes, use a two-step migration approach (expand → migrate data → contract).


## Logging strategy (V1)

Goals:
- Debug production issues without exposing secrets or PII
- Make core flows traceable

Rules:
1. Never log secrets:
   - passwords
   - session tokens (raw or hash)
   - invite raw tokens
   - full DATABASE_URL
2. Avoid PII in logs:
   - do not log full emails
   - do not log names unless already visible in UI context
3. Log one line per request for key routes (info level):
   - route name
   - companyId (if available)
   - employeeId (if available)
   - outcome (ok / failed)
   - error code (if failed)
4. On server errors:
   - include stable tag: `[ROUTE]`
   - include error message
   - include stack trace **only** when `NODE_ENV !== "production"`

Recommended tags:
- `[AUTH]`
- `[INVITE]`
- `[ONBOARDING]`
- `[HOURS]`
- `[HEALTH]` (optional)

Minimum production level:
- LOG_LEVEL=info



## Data export and deletion requests (V1)

CP Hours handles data export and deletion requests manually in V1.

Process:
1. Requests must be sent via email to the contact address listed in the Privacy Policy.
2. Requests must clearly identify:
   - the company
   - the requester’s role (admin/owner)
3. Requests are verified to prevent unauthorized access or deletion.
4. Data export or deletion is performed manually by CP Hours.
5. Requests are handled within a reasonable time, typically within 30 days.

This manual process is acceptable for V1 and will be replaced with self-service tooling in later versions.
