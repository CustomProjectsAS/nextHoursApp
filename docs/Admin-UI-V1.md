# Admin UI — V1 (SaaS-Grade) Checklist

> Authoritative scope. Frozen.
> No Excel-style UI. No scope creep.

---

## 0. Scope lock (READ ONCE)

- [x] V1 scope explicitly frozen
- [x] Timeline defined as read-only
- [x] Hours tab defined as primary action hub
- [x] Spreadsheet / dense grid UI explicitly forbidden
- [ ] Checklist is the single source of truth

---

## 1. Admin Landing Page (Command Foyer)

**Goal:** Immediate awareness. No work done here.

### Structure
- [ ] Separate landing route exists
- [x] Tabs are global (visible across admin)
- [ ] Landing loads lightweight data only

### Panels (exactly 4)
- [ ] Pending hours panel
- [ ] Rejected entries panel
- [ ] Active today / this week panel
- [ ] Anomalies panel

### Panel rules
- [ ] Panels show counts only
- [ ] Panels route to correct tab + filter
- [ ] No editing possible on landing
- [ ] No charts / graphs

**DONE definition:**  
Admin understands priorities in <5 seconds.

---

## 2. Hours Tab (Primary Admin Work Surface)

**Goal:** Process time entries efficiently.

### Default behavior
- [x] Hours tab exists
- [x] Status model implemented (PENDING / APPROVED / REJECTED)
- [ ] Default filter = PENDING
- [ ] Pending entries shown first

### Entry display
- [x] Employee name visible
- [x] Date visible
- [x] From / To visible
- [x] Net hours visible
- [x] Project visible
- [x] Status visible

### Actions
- [x] Approve available for PENDING
- [x] Reject available for PENDING
- [x] Edit available for PENDING
- [x] Edit available for REJECTED
- [x] Approved entries locked

### Rejection handling
- [x] Rejection requires reason
- [x] Rejection reason visible
- [x] Editing rejected entry resets to PENDING

### UX rules
- [ ] UI optimized for queue processing
- [x] No timeline embedded in Hours tab
- [x] One row = one decision

### Explicitly NOT in V1
- [x] No bulk approve
- [x] No payroll export
- [x] No cross-month editing

**DONE definition:**  
Admin can clear all pending entries without leaving this tab.

---

## 3. Timeline Tab (Context & Investigation)

**Goal:** Visual understanding of overlap and workload.

### Global rules
- [x] Timeline tab exists
- [x] Timeline is read-only
- [x] No approve / reject actions
- [ ] All interactions lead to Hours tab

---

### Day View
- [x] Day view exists
- [x] Chunky horizontal blocks
- [x] Clear employee rows
- [x] Overlaps visually obvious
- [ ] Hover shows project + time
- [ ] Click routes to Hours tab with filter

**Status:** REQUIRED V1

---

### Week View
- [x] Week view exists
- [ ] Rows constrained for readability
- [ ] No dense calendar grid
- [ ] Visual parity with Day view

**Status:** ALLOWED V1 (constrained)

---

### Month View
- [ ] Month summary view exists
- [ ] Presence / totals only
- [x] Dense grid version explicitly banned
- [x] Excel-style month view removed

**Status:** SUMMARY ONLY (no grid)

**DONE definition:**  
Admin can spot anomalies and jump to Hours to act.

---

## 4. Projects Tab (V1-Minimal)

**Goal:** Maintain valid work categories.

### Allowed
- [x] Project list exists
- [x] Create project
- [x] Rename project
- [x] Assign color
- [x] Active / inactive toggle

### UX rules
- [ ] UI simplified to minimal list
- [x] No analytics present

### Explicitly NOT in V1
- [x] No project timelines
- [x] No cost tracking
- [x] No notes / descriptions

**DONE definition:**  
Projects support Hours and Timeline only.

---

## 5. Employees Tab (V1-Minimal)

**Goal:** Control who can submit hours.

### Allowed
- [x] Employee list exists
- [x] Invite employee flow exists
- [x] Deactivate employee
- [x] Active status visible

### UX rules
- [ ] No profile pages
- [ ] No extra metadata exposed

### Explicitly NOT in V1
- [x] No performance views
- [x] No ratings
- [x] No HR features

**DONE definition:**  
Admin can control access cleanly.

---

## 6. Global UX Rules (Non-Negotiable)

- [x] Tabs always visible
- [ ] Landing page optional after login
- [x] Big click targets
- [x] Chunky spacing
- [x] Clear color coding
- [x] No spreadsheet aesthetics anywhere

If it looks like Excel → it is wrong.

---

## 7. V1 Completion Gate

Before Admin UI V1 is DONE:
- [ ] All unchecked items reviewed
- [ ] No banned features implemented
- [ ] Admin flow tested:
  - Login → Landing → Hours → Timeline → Back
- [ ] Each screen serves exactly one job

---

**Status:** 🚧 IN PROGRESS  
**Scope:** 🔒 LOCKED


## Appendix (Optional)

### Deferred ideas (explicitly NOT V1)
- Bulk approve
- Advanced analytics
- Dense month timeline
- Payroll exports
