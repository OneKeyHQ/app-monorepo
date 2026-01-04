---
name: auditing-pre-release-security
description: Audits security and supply-chain risk between two git refs, 预发布安全审计 
---

# Pre-Release Security Audit (Between Any Two Git Refs)

This skill compares **any two git refs** (tag/branch/commit SHA) and audits:
- Source-code diffs for security regressions
- Dependency changes (direct + transitive) and lockfile determinism
- Newly introduced package behaviors inside `node_modules`
- CI/CD workflow risks in `.github/workflows` and build configs (Expo/EAS)

The output is a **Chinese** Markdown report, with a unique title and filename containing the refs to avoid overwrites.

## 0) Mandatory: confirm audit range (BASE_REF, TARGET_REF)

### Ref rules
- Accepted: tag / branch / commit SHA
- `BASE_REF` = starting point, `TARGET_REF` = ending point (release candidate)

### If refs are not explicitly provided by the user
Ask exactly once before doing any work:

> Which two git refs should I compare? (e.g. `v5.19.0` → `release/v5.20.0`, or `main` → `feature/xxx`)

### If only one ref is provided
Ask for the missing ref. Do **not** assume defaults unless the user explicitly says:
- “latest tag → HEAD”
- or provides an equivalent instruction.

---

## 1) Output requirements (hard constraints)

- Report language: **Chinese**
- Report filename must include refs to avoid collisions:
  - `security-audit__${BASE_REF_SAFE}__to__${TARGET_REF_SAFE}.md`
  - `BASE_REF_SAFE`/`TARGET_REF_SAFE` must replace `/` with `__` (or `-`) for filesystem safety.
- Report title must include refs:
  - `# 安全预审报告（${BASE_REF} → ${TARGET_REF}）`
- Evidence must be traceable: file path + line numbers (when possible) + short snippet.

---

## 2) Safety rules (must follow)

- Never print or paste secrets: mnemonics/seed phrases, private keys, signing payloads, API keys, tokens, cookies, session IDs.
- If command outputs may contain secrets (env dumps, logs), redact before writing to the report.
- Prefer short excerpts; do not paste large bundles.

---

## 3) Execution checklist

### Step A — Verify refs and collect context
- [ ] Verify both refs exist:
  - `git rev-parse --verify "${BASE_REF}^{commit}"`
  - `git rev-parse --verify "${TARGET_REF}^{commit}"`
- [ ] Record:
  - BASE_SHA, TARGET_SHA
  - Working tree clean? `git status --porcelain`
- [ ] List changed files:
  - `git diff --name-status "${BASE_REF}..${TARGET_REF}"`

### Step B — Collect key diffs
Focus on:
- [ ] Source: `**/*.{js,ts,tsx}`
- [ ] Dependencies: `**/package.json`, `yarn.lock`
- [ ] CI: `.github/workflows/**`
- [ ] Expo/EAS configs: `eas.json`, `app.json`, `app.config.*`, build scripts

### Step C — Dependency delta (direct deps)
- [ ] For each changed `package.json`, compute:
  - Added / removed / updated deps (include workspace path)
- [ ] Version range policy checks:
  - Flag `*` / `latest` as High risk
  - Flag `^` / `~` as Medium risk (explain why this matters for release determinism)
- [ ] If deps changed but `yarn.lock` did not, flag as High risk.

### Step D — Lockfile determinism (best-effort)
- [ ] Detect Yarn flavor: `yarn -v`
- [ ] Try one:
  - Yarn Berry: `yarn install --immutable`
  - Yarn Classic: `yarn install --frozen-lockfile`
- [ ] Record anomalies: `resolutions`, `patches`, non-registry sources, unexpected downloads.

### Step E — Known vulnerability scanning (best-effort)
- [ ] `yarn audit` (if available)
- [ ] `osv-scanner` against `yarn.lock` (if available)
- [ ] If missing tools, note “not run + reason”.

### Step F — New dependency deep inspection (node_modules)
For each newly added **direct dependency**:
- [ ] Inspect `<pkg>/package.json`:
  - `preinstall`, `install`, `postinstall` scripts
  - entry points (`main`, `module`, `exports`)
  - binary/native artifacts (`bin/`, `.node`)
- [ ] Keyword scan (case-insensitive) in its installed code:
  - Sensitive: `privateKey|mnemonic|seed|keystore|passphrase`
  - Storage: `localStorage|indexedDB|AsyncStorage|keychain|keystore`
  - Network: `fetch|axios|XMLHttpRequest|http|https|WebSocket|ws`
  - Dynamic exec: `eval|new Function|child_process|spawn|exec`
  - Install hooks: `preinstall|install|postinstall`
- [ ] If hits exist: include **path + line + short snippet** and explain expected vs suspicious behavior.
- [ ] Assign risk rating: Low / Medium / High.

### Step G — Source diff security review (AI reasoning step)
Within `${BASE_REF}..${TARGET_REF}` diffs, prioritize:
- signing flows / key handling / mnemonic
- network layer / RPC / telemetry
- storage layer (local/secure storage)
- logging / analytics / error reporting
Output: suspicious changes list (each with summary, impact, evidence excerpt).

### Step H — CI/CD & build pipeline risks
Inspect `.github/workflows/**` and build configs:
- [ ] Flag `uses: ...@latest` (High)
- [ ] Flag floating tags not pinned to SHA (Medium, note risk)
- [ ] Check `permissions:` for over-broad scopes
- [ ] Flag remote script execution patterns (curl|bash, remote downloads)
- [ ] Note install safety (`--ignore-scripts`, etc.)
- [ ] Expo/EAS: flag hooks that download remote code, run arbitrary scripts, or leak env into logs

---

## 4) Report template (must follow; Chinese output)

Write the report to:
`security-audit__${BASE_REF_SAFE}__to__${TARGET_REF_SAFE}.md`
