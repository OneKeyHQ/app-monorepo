# Audit Workflow

Standalone pre-release security and supply-chain audit. Can run independently or after `diff-check` — if `diff-check` was already executed in the same conversation, reuse its context to avoid redundant work.

## Why This Matters

Bundle releases ship directly to users' devices. A compromised dependency, leaked secret, or signing-flow regression can result in loss of user funds. This audit catches issues before they reach production.

## Pre-flight Checks

### 1. Reuse or detect context

Check whether a `diff-check` was already run in this conversation. If so, the following variables are already known — reuse them directly without re-running detection or fetching:

- `RELEASE_BRANCH` — the target release branch
- `base_sha` / `tag_sha` — baseline commit (from RELEASES.json or App Shell tag)
- Changeset data (commit list, file stats, PR numbers)

If no prior `diff-check` context exists, run the standard detection:

1. Use the **Release Branch Detection** logic from SKILL.md
2. Confirm with the user before proceeding
3. Fetch latest: `git fetch origin "$RELEASE_BRANCH" x`
4. Determine baselines:
   - `tag_sha` from App Shell tag: `git rev-parse "v${VERSION}"`
   - `last_release_sha` from RELEASES.json (highest `seq` entry), or same as `tag_sha` if first release

### 2. Codex readiness

Check whether Codex is available for cross-validation.

Confirm Codex CLI is installed and authenticated. You can verify this by checking whether the `codex:codex-rescue` subagent type is available for dispatch. If uncertain, invoke `/codex:setup` to check readiness.

| Result | Action |
|--------|--------|
| Codex CLI ready | Log: "✅ Codex 就绪。" Set `CODEX_AVAILABLE = true` |
| Codex CLI not ready | Warn: "⚠️ Codex CLI 未就绪，请运行 `/codex:setup`。审计将以降级模式继续。" Set `CODEX_AVAILABLE = false` |

Proceed regardless — Codex enhances but does not gate the audit.

## Report Setup

```
base_sha_short="${tag_sha:0:8}"
RELEASE_BRANCH_SAFE=$(echo "$RELEASE_BRANCH" | tr '/' '__')
REPORT_FILE="security-audit__${base_sha_short}__to__${RELEASE_BRANCH_SAFE}.md"
```

---

## Execution Steps

### Step A — Collect Context

If reusing diff-check context, this data is already available. Otherwise collect:

- List changed files: `git diff --name-status "$tag_sha..$RELEASE_BRANCH"`
- Count stats: `git diff --stat "$tag_sha..$RELEASE_BRANCH"`

### Step B — Collect Key Diffs

Focus on security-relevant file categories:

```bash
# Source code changes
git diff "$tag_sha..$RELEASE_BRANCH" -- '*.ts' '*.tsx' '*.js'

# Dependency changes
git diff "$tag_sha..$RELEASE_BRANCH" -- '**/package.json' 'yarn.lock'

# CI/CD changes
git diff "$tag_sha..$RELEASE_BRANCH" -- '.github/workflows/**'

# Build configs
git diff "$tag_sha..$RELEASE_BRANCH" -- 'eas.json' 'app.json' 'app.config.*'
```

For large diffs, prioritize security-critical paths:
- `packages/kit-bg/src/vaults/` — vault and signing logic
- `packages/shared/src/appCrypto/` — cryptographic operations
- `packages/kit-bg/src/services/` — background services
- `packages/kit/src/views/` — user-facing flows that handle sensitive data

### Step C — Dependency Delta

For each changed `package.json`:
- Compute: added / removed / updated direct dependencies (include workspace path)
- Version policy checks:
  - `*` / `latest` → **🔴 High risk**
  - `^` / `~` → **🟡 Medium risk** (release determinism concern)
- If deps changed but `yarn.lock` unchanged → **🔴 High risk** (lockfile out of sync)

### Step D — Lockfile Determinism (Best-Effort)

```bash
# Detect Yarn flavor
yarn -v

# Try immutable install
yarn install --immutable  # Yarn Berry
# or
yarn install --frozen-lockfile  # Yarn Classic
```

Record anomalies: `resolutions`, `patches`, non-registry sources, unexpected network downloads.

If this step cannot complete (e.g., env constraints), note it and move on.

### Step E — Known Vulnerability Scanning (Best-Effort)

```bash
yarn audit        # if available
osv-scanner --lockfile yarn.lock  # if available
```

If tools are missing, note "not run + reason" and continue.

### Step F — New Dependency Deep Inspection

For each **newly added direct dependency** found in Step C:

1. Inspect `node_modules/<pkg>/package.json`:
   - `preinstall`, `install`, `postinstall` scripts
   - Entry points: `main`, `module`, `exports`
   - Binary/native artifacts: `bin/`, `.node`

2. Keyword scan (case-insensitive) in installed code:
   - **Sensitive**: `privateKey|mnemonic|seed|keystore|passphrase`
   - **Storage**: `localStorage|indexedDB|AsyncStorage|keychain`
   - **Network**: `fetch|axios|XMLHttpRequest|WebSocket`
   - **Dynamic exec**: `eval|new Function|child_process|spawn|exec`
   - **Install hooks**: `preinstall|postinstall`

3. If hits exist: include path + line + short snippet, explain expected vs suspicious behavior
4. Assign risk rating: Low / Medium / High

### Step G — Source Diff Security Review

Within the `$tag_sha..$RELEASE_BRANCH` diffs, prioritize reviewing:

| Priority | Area | What to look for |
|----------|------|------------------|
| 🔴 Critical | Signing / key handling / mnemonic | Any modification to vault logic, transaction signing, seed derivation |
| 🔴 Critical | Secret leakage | console.log/error with sensitive data, analytics tracking private info |
| 🟠 High | Network layer / RPC / telemetry | New endpoints, outbound requests, WebSocket changes |
| 🟠 High | Storage layer | Local/secure storage changes, encryption modifications |
| 🟡 Medium | Logging / analytics / error reporting | New data being collected or transmitted |
| 🟡 Medium | Dynamic execution | eval, new Function, child_process in new code |

Output: list of suspicious changes, each with summary, impact assessment, and evidence excerpt.

### Step H — CI/CD & Build Pipeline Risks

Inspect `.github/workflows/**` and build configs in the diff:

- `uses: ...@latest` → **🔴 High risk**
- Floating tags not pinned to SHA → **🟠 Medium risk**
- `permissions:` with over-broad scopes
- Remote script execution patterns (`curl|bash`, remote downloads)
- Install safety (`--ignore-scripts`, etc.)
- Build hooks that download remote code, run arbitrary scripts, or leak env into logs

### Step I — Codex Cross-Validation

**Skip if `CODEX_AVAILABLE = false`.**

The purpose is to get an independent second opinion. Codex reviews the same diff without seeing primary findings, so its conclusions serve as genuine cross-validation.

#### I.1 — Dispatch audit to Codex

Use the `Agent` tool to dispatch an independent security review:

```
Agent(
  subagent_type = "codex:codex-rescue",
  prompt = "Security audit for OneKey crypto wallet monorepo (bundle release).
Comparing ${tag_sha} → ${RELEASE_BRANCH}.

Changed files:
${CHANGED_FILES_LIST}

Full diff:
${DIFF_CONTENT}

Review focus areas:
1. Secret/PII leakage — mnemonic, private key, seed, API key exposure
2. Supply-chain risks — new/updated dependencies, install scripts
3. Auth/signing flow changes — key handling, transaction signing, vault logic
4. Network layer — new RPC endpoints, telemetry, WebSocket changes
5. Storage layer — local/secure storage, encryption, keychain access
6. CI/CD pipeline — workflow permissions, unpinned actions, remote scripts
7. Dynamic execution — eval, new Function, child_process patterns

For each finding report: file path, line, severity, category, description, suggested fix."
)
```

If diff > 50KB, prioritize including in the prompt:
1. Dependency changes (`package.json` + `yarn.lock` diffs)
2. Security-critical source diffs (vault, signing, crypto, auth)
3. CI/CD and build config changes
4. Note which areas were omitted from the prompt.

#### I.2 — Parse Codex findings

The Agent result returns Codex's output as text. If empty or failed, log and continue without Codex findings.

Extract findings with: file path, line, severity, category, description, suggested fix.

### Step J — Merge and Cross-Validate

Combine primary findings (Steps C–H) with Codex findings (Step I).

#### Cross-validation rules

| Scenario | Action | Confidence |
|----------|--------|------------|
| Both found same issue | Mark `{Cross-validated ✅}` | Auto-promote to 🔵 High |
| Primary-only | Include normally | Keep original assessment |
| Codex-only | Include with `[Codex]` tag, review against source | Default 🟠 Medium |
| Conflicting assessment | Include both, flag for human review | ⚪ Low |

#### Deduplication
Same issue flagged by both → keep more detailed description, note both sources.

#### Confidence levels

| Tag | Meaning |
|-----|---------|
| 🔵 High | Confirmed from code or cross-validated by both reviewers |
| 🟠 Medium | Likely issue, single reviewer or needs context |
| ⚪ Low | Possible issue, needs human judgment |

---

## Audit Result Classification

| Findings | Conclusion |
|----------|------------|
| No 🔴 Critical or 🟠 High findings | ✅ Security audit passed |
| 🟠 High findings only (no Critical) | ⚠️ Review required — list findings, recommend human review before publishing |
| Any 🔴 Critical finding | 🚫 Publishing blocked — must fix Critical issues first |

---

## Output Summary

IMPORTANT: Do NOT put compare URLs inside code blocks — render as clickable markdown links.

---

=== Security Audit Report ===

🔒 **Audit range**: $tag_sha_short → $RELEASE_BRANCH
- $file_count files changed, +$insertions / -$deletions lines
- Codex cross-validation: ✅ Enabled / ⚠️ Degraded

📋 **Findings**: N Critical, M High, K Medium, L Low
- [list key findings here]

📄 Full report: `$REPORT_FILE`

**Result**: ✅ Passed / ⚠️ Review required / 🚫 Blocked

Next: `/1k-bundle-release publish` (if passed)

---

## Report Template (Chinese)

Write to `$REPORT_FILE`:

```markdown
# 安全预审报告（${tag_sha_short} → ${RELEASE_BRANCH}）

## 审计概要
- **审计范围**: ${tag_sha_short} → ${RELEASE_BRANCH}
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
<!-- Include only if CODEX_AVAILABLE = true -->

| # | 发现 | Primary | Codex | 状态 | 置信度 |
|---|------|---------|-------|------|--------|
| 1 | 描述 | ✅ | ✅ | Cross-validated ✅ | 🔵 High |

**一致性统计**: N 项交叉验证 / M 项仅 Primary / K 项仅 Codex

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
**描述**: ...
**证据**:
```
代码片段
```
**修复建议**: ...

---

## 修复清单

| 优先级 | 置信度 | 文件 | 类型 | 来源 | 描述 |
|--------|--------|------|------|------|------|
| 🔴 | 🔵 | file.tsx:42 | secret-leak | Both | 描述 |

## 测试建议
1. ...

## 审计方法说明
- Primary 审计: AI 逐步执行 Steps A–H
- Codex 交叉验证: 通过官方 Codex 插件独立审查同一 diff（Step I）
- 合并策略: 交叉验证提升置信度，冲突标记人工复核（Step J）
```

---

## Safety Rules

- **Never** print or paste secrets: mnemonics, seed phrases, private keys, API keys, tokens
- If command output may contain secrets, redact before writing to report
- Prefer short excerpts; do not paste large code blocks verbatim
