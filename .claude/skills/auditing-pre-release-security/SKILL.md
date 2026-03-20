---
name: auditing-pre-release-security
description: Audits security and supply-chain risk between two git refs with Codex MCP cross-validation. 预发布安全审计（含 Codex 交叉验证）。Use when performing pre-release security audits, supply-chain reviews, or comparing two git refs for security regressions. Triggers on “预发布审计”, “security audit”, “release audit”, “安全预审”.
---

# Pre-Release Security Audit (Between Any Two Git Refs)

This skill compares **any two git refs** (tag/branch/commit SHA) and audits:
- Source-code diffs for security regressions
- Dependency changes (direct + transitive) and lockfile determinism
- Newly introduced package behaviors inside `node_modules`
- CI/CD workflow risks in `.github/workflows` and build configs (Expo/EAS)
- **Codex MCP cross-validation** — independent AI review for cross-checking

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

## 3) Pre-flight: Codex MCP readiness check

Before starting any audit work, verify that Codex MCP is operational. This is a hard prerequisite — the audit relies on Codex for cross-validation, so a broken Codex means a degraded audit.

### Check procedure

1. **Tool availability** — Confirm `mcp__codex__codex` exists in available tools
2. **Connectivity probe** — Send a lightweight test query to Codex:
   ```
   mcp__codex__codex: “Health check: respond with 'OK' if you can process requests.”
   ```
3. **Retrieve response** — Call `mcp__codex__codex-reply` to confirm a valid response is returned

### Outcome handling

| Result | Action |
|--------|--------|
| **Tool not found** | Warn user: “⚠️ Codex MCP 未在可用工具中找到，请检查 MCP 服务器配置。审计将以降级模式继续（无交叉验证）。” Set `CODEX_AVAILABLE = false`. |
| **Probe fails / timeout** | Warn user: “⚠️ Codex MCP 连接失败（超时或错误响应），请检查 MCP 服务是否正常运行。审计将以降级模式继续。” Set `CODEX_AVAILABLE = false`. |
| **Probe returns valid response** | Log: “✅ Codex MCP 就绪。” Set `CODEX_AVAILABLE = true`. |

Record the Codex status in the report header. Proceed with the audit regardless — Codex enhances but does not gate the audit.

---

## 4) Execution checklist

### Step A — Verify refs and collect context
- [ ] Verify both refs exist:
  - `git rev-parse --verify “${BASE_REF}^{commit}”`
  - `git rev-parse --verify “${TARGET_REF}^{commit}”`
- [ ] Record:
  - BASE_SHA, TARGET_SHA
  - Working tree clean? `git status --porcelain`
- [ ] List changed files:
  - `git diff --name-status “${BASE_REF}..${TARGET_REF}”`

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

### Step I — Codex MCP cross-validation audit

**Skip this step if `CODEX_AVAILABLE = false`.**

The purpose of this step is to get an independent second opinion from Codex. Codex reviews the same diff without seeing your primary findings, so its conclusions serve as genuine cross-validation — agreement strengthens confidence, disagreement flags areas needing human attention.

#### I.1 — Send audit request to Codex

Prepare the diff summary and send to `mcp__codex__codex`:

```
Security audit for OneKey crypto wallet monorepo.
Comparing ${BASE_REF} (${BASE_SHA}) → ${TARGET_REF} (${TARGET_SHA}).

Changed files:
${CHANGED_FILES_LIST}

Full diff:
${FULL_DIFF or chunked sections if too large}

Review focus areas:
1. **Secret/PII leakage** — mnemonic, private key, seed, API key exposure via logs, network, storage
2. **Supply-chain risks** — new/updated dependencies, install scripts, suspicious package behavior
3. **Auth/signing flow changes** — any modification to key handling, transaction signing, vault logic
4. **Network layer** — new RPC endpoints, telemetry, outbound requests, WebSocket changes
5. **Storage layer** — changes to local/secure storage, encryption, keychain access
6. **CI/CD pipeline** — workflow permission changes, unpinned actions, remote script execution
7. **Dynamic execution** — eval, new Function, child_process patterns in new code

For each finding report:
- File path and line number
- Severity: Critical / High / Medium / Low
- Category: secret-leak / supply-chain / auth-bypass / network / storage / ci-cd / dynamic-exec / other
- Description of the risk
- Suggested remediation
```

If the diff is too large for a single message (>50KB), chunk by risk category:
1. First message: dependency changes (`package.json` + `yarn.lock` diffs)
2. Second message: security-critical source diffs (vault, signing, crypto, auth)
3. Third message: CI/CD and build config changes
4. Fourth message: remaining source diffs

#### I.2 — Retrieve Codex response

Call `mcp__codex__codex-reply` to collect the response. If the response is empty or an error, log it and continue without Codex findings.

#### I.3 — Parse Codex findings

Extract structured findings from the Codex response. For each finding, record:
- File path + line
- Severity
- Category
- Description
- Codex's suggested fix (if any)

### Step J — Merge and cross-validate findings

Combine findings from the primary audit (Steps C–H) with Codex findings (Step I) into a unified list.

#### Cross-validation rules

| Scenario | Action | Confidence |
|----------|--------|------------|
| **Both found same issue** (same file, same category) | Mark `{Cross-validated ✅}` | Auto-promote to 🔵 High |
| **Primary-only finding** | Include normally | Keep original assessment |
| **Codex-only finding** | Include with `[Codex]` tag, review against source to assign confidence | Default 🟠 Medium, adjust after manual review |
| **Conflicting assessment** (one says safe, other flags risk) | Include both perspectives, flag for human review | ⚪ Low with note |

#### Deduplication

When primary and Codex flag the same issue with different descriptions, keep the more detailed description and note both sources. Do not list the same issue twice.

#### Confidence levels

| Tag | Meaning | When to use |
|-----|---------|-------------|
| **🔵 High** | Confirmed from code or cross-validated | Clear vulnerability, both reviewers agree, or verifiable from source |
| **🟠 Medium** | Likely issue, single reviewer or needs context | Pattern suggests risk, might be intentional |
| **⚪ Low** | Possible issue, needs human judgment | Heuristic match, conflicting signals, depends on business logic |

---

## 5) Report template (must follow; Chinese output)

Write the report to:
`security-audit__${BASE_REF_SAFE}__to__${TARGET_REF_SAFE}.md`

```markdown
# 安全预审报告（${BASE_REF} → ${TARGET_REF}）

## 审计概要
- **审计范围**: ${BASE_REF} (${BASE_SHA}) → ${TARGET_REF} (${TARGET_SHA})
- **变更文件数**: X 个文件, +Y / -Z 行
- **Codex 交叉验证**: ✅ 已启用 / ⚠️ 降级模式（原因）
- **审计日期**: YYYY-MM-DD

## 风险总览

| 等级 | 数量 | 交叉验证数 |
|------|------|------------|
| 🔴 Critical | N | M |
| 🟠 High | N | M |
| 🟡 Medium | N | M |
| 🟢 Low | N | M |

## Codex 交叉验证摘要
<!-- REQUIRED if Codex was used, OMIT section if CODEX_AVAILABLE = false -->

| # | 发现 | Primary | Codex | 状态 | 置信度 |
|---|------|---------|-------|------|--------|
| 1 | 问题描述 | ✅ | ✅ | Cross-validated ✅ | 🔵 High |
| 2 | 问题描述 | ✅ | — | 仅 Primary | 🟠 Medium |
| 3 | 问题描述 | — | ✅ | 仅 Codex [已确认] | 🟠 Medium |

**一致性统计**: N 项交叉验证 / M 项仅 Primary / K 项仅 Codex
**Codex 独有发现中确认为真的**: X / K

## 依赖变更分析 (Step C)
...

## Lockfile 确定性检查 (Step D)
...

## 已知漏洞扫描 (Step E)
...

## 新依赖深度检查 (Step F)
...

## 源码安全审查 (Step G)
...

## CI/CD 管道风险 (Step H)
...

## 发现的问题（合并后）

### [🔴 Critical] [🔵 High] 问题标题 {Cross-validated ✅}
**文件**: `path/to/file.tsx:42`
**类型**: secret-leak / supply-chain / auth-bypass / network / storage / ci-cd
**来源**: Primary + Codex
**描述**: 问题描述，风险说明
**证据**:
\```
代码片段
\```
**修复建议**: ...

---

### [🟠 High] [🟠 Medium] 问题标题 [Codex]
**文件**: `path/to/file.tsx:18`
**类型**: ...
**来源**: Codex（已人工确认）
**描述**: ...
**修复建议**: ...

---

## 修复清单

| 优先级 | 置信度 | 文件 | 类型 | 来源 | 描述 |
|--------|--------|------|------|------|------|
| 🔴 Critical | 🔵 High | file1.tsx:42 | secret-leak | Primary+Codex | 描述 |
| 🟠 High | 🟠 Medium | file2.tsx:18 | supply-chain | Codex | 描述 |

## 测试建议
1. 测试场景
2. 测试场景

## 审计方法说明
- Primary 审计: 本地 AI 逐步执行 Steps A–H
- Codex 交叉验证: 独立 AI 审查同一 diff（Step I）
- 合并策略: 交叉验证提升置信度，冲突标记人工复核（Step J）
```
