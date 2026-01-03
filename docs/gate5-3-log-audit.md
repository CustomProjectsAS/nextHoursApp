# Gate 5.3 — Log Safety Audit

Purpose:
Prove that no runtime code logs secrets, invite tokens, auth headers, or cookies
outside the structured logger (`lib/log.ts`).

This audit is required by Gate 5.3 and must be reproducible.

---

## Command used

Executed from repo root:

```powershell
Get-ChildItem -Path . -Recurse -File `
  -Include *.ts,*.tsx,*.js `
  -Exclude *.d.ts `
| Where-Object {
    $_.FullName -notmatch "\\node_modules\\|\\.next\\|\\.git\\|\\dist\\|\\build\\|\\coverage\\"
  } `
| Select-String -Pattern "console\.log\(|console\.error\(|console\.warn\(|log\.debug\(|log\.info\(|log\.warn\(|log\.error\("
