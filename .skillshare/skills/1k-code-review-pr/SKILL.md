---
name: 1k-code-review-pr
description: Comprehensive PR code review for OneKey monorepo. Use when reviewing PRs, code changes, or diffs — covers security (secrets/PII leakage, supply-chain, AuthN/AuthZ), code quality (hooks, race conditions, null safety, concurrent requests), and OneKey-specific patterns (Fabric crashes, MIUI, BigNumber). Triggers on "review PR", "review this PR", "code review", "check this diff", "审查 PR", "代码审查", "review #123". Always use this skill for any PR review task in this repo, even if the user doesn't explicitly mention "code review".
allowed-tools: Read, Grep, Glob, Bash, WebFetch
---

# OneKey PR Code Review

**输出语言**: 中文

## Review Scope

- Base branch: `x`
- Diff: `git fetch origin && git diff origin/x...HEAD` (triple-dot)

## Workflow

1. **Checkout** — `gh pr checkout <PR_NUMBER>` (skip if already on branch)
2. **Scope** — `git diff origin/x...HEAD --stat` to see change scope
3. **Triage** — Determine which review modules apply (see triage table)
4. **Primary Review** — Read each changed file, apply relevant checks from `references/`
5. **Codex Cross-Review** — If Codex MCP available, run full parallel review (see below)
6. **PR Comment Analysis** — Fetch all existing PR comments (bot + human), analyze with local codebase context (see below)
7. **Merge Findings** — Combine primary + Codex + PR comment findings, deduplicate, annotate confidence
8. **Score** — Rate the PR across 4 dimensions (see Scoring System). **This step is MANDATORY — every report MUST include the scoring table.**
9. **Report** — Generate structured report using the unified format. **Follow the template exactly — every section is required.**
10. **GH Comment** — For Blocker issues, offer to post inline PR comments (with confirmation)

## Codex MCP Integration

Check if `mcp__codex__codex` is in available tools.

**If available:**
1. Send the full diff to Codex for an independent full review:
   ```
   Review this PR diff for the OneKey crypto wallet monorepo. Focus on:
   - Security vulnerabilities (secret leakage, auth bypass, supply-chain risks)
   - Runtime bugs (race conditions, null safety, memory leaks)
   - Architecture violations (import hierarchy, cross-platform issues)
   - Code quality (hooks safety, error handling, performance)
   Report each finding with: file:line, severity (Critical/High/Medium/Low), description, fix suggestion.
   ```
2. Retrieve response via `mcp__codex__codex-reply`
3. Merge into primary review:
   - **Both found same issue** → Mark `{Cross-validated ✅}`, auto-promote to 🔵 High confidence
   - **Codex-only finding** → Include with tag `[Codex]`, review manually to assign confidence
   - **Primary-only finding** → Include normally
4. Add a **Codex 交叉验证摘要** table in the report (see report template)

**If unavailable:** Skip silently. Set "Codex 交叉验证: ⏭️ 未启用" in the report header. Do NOT mention Codex anywhere else.

## PR Comment Analysis

Collect ALL existing comments on the PR — bot and human — then analyze each with your local codebase context. You have full source access, type system, and dependency graph; most commenters only saw the diff. Use this asymmetry.

### Fetching All Comments

Use `gh api` to get full user metadata (including `type` field for bot detection):

```bash
# Top-level PR reviews (review bodies)
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews \
  --jq '[.[] | select(.body != "") | {author: .user.login, is_bot: (.user.type == "Bot"), body: .body, state: .state, association: .author_association}]'

# Inline review comments (file:line annotations)
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --jq '[.[] | {author: .user.login, is_bot: (.user.type == "Bot"), path: .path, line: .line, body: .body, association: .author_association}]'

# General PR comments (issue-level)
gh api repos/{owner}/{repo}/issues/{pr_number}/comments \
  --jq '[.[] | {author: .user.login, is_bot: (.user.type == "Bot"), body: .body, association: .author_association}]'
```

**Bot detection** — use the `user.type == "Bot"` field from GitHub API, not hardcoded username lists. This automatically covers any bot (current and future) without maintenance.

If no comments exist, set "PR 评论分析: ⏭️ 无评论" in the report header and skip this section.

### Analysis Framework

For each substantive comment (skip empty approvals, CI status badges, pure formatting):

| Verdict | Meaning | Action |
|---------|---------|--------|
| **✅ Confirmed** | Comment identifies a real issue | Include in findings, tag source `[<author>]` |
| **🔍 Enriched** | Real issue, but analysis is shallow or fix is wrong | Include with deeper fix guidance from your codebase knowledge |
| **❌ Noise** | Not an issue given full codebase context | Note in "评论误报分析" with brief explanation of why |
| **📋 Already Covered** | Your primary review caught it | Cross-validate, boost confidence |

**Your local advantages — use them aggressively:**
- **Full source** — trace data flow across files, not just the diff
- **Type system** — run `tsc`, verify types end-to-end
- **Architecture** — you know OneKey's import hierarchy and platform patterns
- **Dependencies** — `yarn info`, changelogs, actual vulnerability reachability
- **Runtime reasoning** — state flows, async lifecycles, race conditions

When someone flags something vague, dig into the source to confirm or refute. When a comment misses context (e.g., a function is safely guarded upstream), explain why. When a comment is right, amplify with richer context.

### Cross-Validation Rules

- Comment + primary review agree → Mark `{Cross-validated ✅}`, promote to 🔵 High
- Comment-only finding you confirm → Include at appropriate confidence with `[<author>]` tag
- Comment-only finding you can't confirm or refute → Include as ⚪ Low with note
- Comment you refute with evidence → Add to "评论误报分析" section

### Security Comment Special Handling

For security-related comments (from bots like Snyk/Dependabot or from human reviewers):
- **Vulnerability reports** — check if the vulnerable code path is actually reachable in OneKey's usage
- **License issues** — verify against OneKey's license policy
- **Dependency alerts** — check if the flagged version is actually used (not just in lockfile)

## Triage: Which Checks to Run

Run `git diff origin/x...HEAD --name-only` and match:

| Changed Files Match | Load |
|---------------------|------|
| `package.json`, lockfiles, `node_modules` patches, `patches/*.patch` | [security-and-supply-chain.md] — full supply-chain review |
| `**/auth/**`, `**/vault/**`, `**/signing/**`, `**/crypto/**`, `manifest.json`, `**/manifest/*.js` | [security-and-supply-chain.md] — full security review |
| Any `.ts`/`.tsx` with business logic | [code-quality-patterns.md] — hooks, race conditions, null safety |
| `.android.ts(x)`, `.ios.ts(x)`, `.native.ts(x)`, `.desktop.ts(x)`, `.ext.ts(x)`, `.web.ts(x)`, native modules, `BigNumber` usage | [onekey-platform-patterns.md] — platform crashes & numeric safety |
| Shell scripts (`.sh`), CI workflows (`.yml`) | [onekey-platform-patterns.md] — build & CI section |

**Always check** regardless of file type:
- Accidental file commits (`.DS_Store`, `.env`, `node_modules`)
- Import hierarchy violations (see below)
- PR description matches actual changes
- Run relevant commands from [quick-commands.md]

## Import Hierarchy (ALWAYS verify)

```
@onekeyhq/shared     <- FORBIDDEN to import from other OneKey packages
    ↓
@onekeyhq/components <- ONLY imports shared
    ↓
@onekeyhq/core       <- ONLY imports shared
    ↓
@onekeyhq/kit-bg     <- imports shared, core (NEVER components or kit)
    ↓
@onekeyhq/kit        <- imports shared, components, kit-bg
    ↓
apps/*               <- imports all
```

```bash
# Quick hierarchy violation check on changed files
git diff origin/x...HEAD --name-only | grep -E '\.tsx?$' | \
  while IFS= read -r f; do [ -f "$f" ] && grep -l "from.*@onekeyhq" "$f" 2>/dev/null; done | \
  while IFS= read -r f; do echo "=== $f ==="; grep "from.*@onekeyhq" "$f"; done
```

## File Risk Classification

| Risk | Patterns | Action |
|------|----------|--------|
| **Critical** | `**/vault/**`, `**/signing/**`, `**/crypto/**`, `**/core/src/**`, hardware wallet SDK | Line-by-line review |
| **High** | `**/auth/**`, API endpoints, state management, `package.json`, `manifest.json` | Deep review |
| **Medium** | UI components, platform-specific code, background services | Standard review |
| **Low** | Comments, type-only, formatting, tests, docs | Scan for anomalies |

## Scoring System

**MANDATORY** — every report must include this scoring table, no exceptions.

Rate the PR on 4 dimensions (1-10 each):

| Dimension | Weight | What to evaluate |
|-----------|--------|-----------------|
| **🔒 安全性** | 35% | Secret leakage, auth bypass, supply-chain risk, input validation |
| **💎 代码质量** | 30% | Hooks safety, error handling, race conditions, null safety, DRY |
| **🏛️ 架构合理性** | 20% | Import hierarchy, separation of concerns, cross-platform consistency |
| **✅ 完整性** | 15% | Edge cases handled, test coverage, migration paths, docs |

**Total Score** = weighted average, rounded to 1 decimal.

| Score | Verdict | Action |
|-------|---------|--------|
| **8.0 - 10.0** | ✅ 可直接合入 | No blockers, minor suggestions only |
| **5.0 - 7.9** | ⚠️ 需修改后复审 | Has issues that should be fixed before merge |
| **< 5.0** | ❌ 建议打回重做 | Fundamental issues in security or architecture |

**Scoring anchors** — to keep scores consistent:
- Start at 8 for each dimension, deduct for issues found
- A single Critical security issue → Security capped at 3
- A single High bug → Code Quality capped at 5
- Import hierarchy violation → Architecture capped at 4

## Confidence Levels

**MANDATORY** — every finding must use exactly one of these three emoji tags. Do NOT use percentages, do NOT use plain text like "高/中/低" without the emoji. Always use this exact format:

| Tag | Meaning | When to use |
|-----|---------|-------------|
| **🔵 High** | Confirmed, verifiable from code | Clear bug, obvious violation, reproducible |
| **🟠 Medium** | Likely issue, needs context | Pattern suggests problem, might be intentional |
| **⚪ Low** | Possible issue, needs human check | Heuristic match, depends on business logic |

Cross-validated findings (primary + Codex agree, or primary + PR comment agree) → automatically **🔵 High**.

## Auto-Fix Patches

**MANDATORY for these categories** — if a finding matches one of these, you MUST include a diff patch:
- `console.error/warn/log` → project logger (`defaultLogger`)
- Missing optional chaining on nullable refs
- Import hierarchy violations
- Missing cleanup in useEffect
- BigNumber type coercion (`Number(decimals)`)
- Missing type in union type definitions

**Format — always use this exact structure:**
```markdown
**Auto-fix:**
\```diff
- old code
+ new code
\```
```

For other findings where the fix is unambiguous and doesn't require business context, also include auto-fix. When in doubt, include it — it's more useful to have a suggested fix than not.

Do NOT generate auto-fix for:
- Logic changes requiring business context understanding
- Security fixes needing architectural decisions
- Performance optimizations with tradeoffs

## GH CLI Inline Comments

After generating the report, if there are findings that meet the comment threshold:

**Comment threshold**: 🔴 高 priority (any confidence) OR 🟡 中 priority with 🔵 High confidence. This means:
- All 🔴 高 findings (regardless of confidence)
- All 🟡 中 findings with 🔵 High confidence (cross-validated or confirmed from code)
- Excludes: 🟢 低 findings, and 🟡 中 with 🟠 Medium or ⚪ Low confidence

1. List the qualifying findings that warrant PR comments
2. **Ask the reviewer**: "以下问题建议直接评论到 PR 上，是否确认？"
3. **Only after explicit yes**, post via:

```bash
# Inline comment on specific file:line
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --field body="🟡 **问题标题**: 描述...

**建议修复:**
\`\`\`suggestion
修复代码
\`\`\`

_— Auto-review by Claude_" \
  --field path="path/to/file.tsx" \
  --field line=42 \
  --field side="RIGHT" \
  --field commit_id="$(git rev-parse HEAD)"
```

**Rules:**
- Never post without explicit reviewer confirmation
- Only post findings meeting the comment threshold (see above)
- Include auto-fix in `suggestion` block when available
- Maximum 5 inline comments per PR

## Unified Report Format

**CRITICAL: Follow this template exactly. Every section marked [REQUIRED] must appear in every report. Do not skip or reorder sections.**

```markdown
# PR #NUMBER 代码审查报告

## 审查概要 [REQUIRED]
- **变更范围**: X 个文件, +Y / -Z 行
- **风险等级**: Critical / High / Medium / Low
- **涉及平台**: Extension / Mobile / Desktop / Web
- **Codex 交叉验证**: ✅ 已启用 / ⏭️ 未启用
- **PR 评论分析**: ✅ 已分析 (N 条评论, 其中 M 条来自 Bot) / ⏭️ 无评论

## 评分 [REQUIRED — NEVER SKIP THIS SECTION]

| 维度 | 得分 | 说明 |
|------|------|------|
| 🔒 安全性 | X/10 | 简要说明 |
| 💎 代码质量 | X/10 | 简要说明 |
| 🏛️ 架构合理性 | X/10 | 简要说明 |
| ✅ 完整性 | X/10 | 简要说明 |
| **总分** | **X.X/10** | **✅ 可直接合入 / ⚠️ 需修改后复审 / ❌ 建议打回** |

## Codex 交叉验证摘要 [REQUIRED if Codex was used, OMIT if not]

| 发现 | Primary | Codex | 状态 |
|------|---------|-------|------|
| 问题描述 | Yes/No | Yes/No | 交叉验证 / 仅 Primary / 仅 Codex |

## PR 评论分析 [REQUIRED if comments exist, OMIT if none]

| 来源 | 类型 | 发现 | 判定 | 说明 |
|------|------|------|------|------|
| Snyk | 🤖 Bot | 依赖漏洞 CVE-XXXX | ✅ Confirmed | 漏洞路径在 OneKey 中可达 |
| @reviewer | 👤 Human | 缺少 null check | 🔍 Enriched | 实际需要在上游 hook 中处理 |
| Devin | 🤖 Bot | 变量命名建议 | ❌ Noise | 命名符合项目规范 |

### 评论误报分析 [OMIT if no noise findings]
- **[来源] 误报**: 具体说明为什么这不是问题（引用源码上下文）

## 发现的问题 [REQUIRED]

### [🔴 高] [🔵 High] 问题标题 {Cross-validated ✅}
**文件**: `path/to/file.tsx:42`
**类型**: 安全 / 构建 / 运行时 / 性能 / 规范
**描述**: 问题是什么，为什么有风险
**Auto-fix:**
\```diff
- old code
+ new code
\```

---

### [🟡 中] [🟠 Medium] 问题标题
**文件**: `path/to/file.tsx:18`
**类型**: 运行时
**描述**: ...
**修复建议**: ...

---

## 修改清单 [REQUIRED]

| 优先级 | 置信度 | 文件 | 类型 | 描述 | Auto-fix |
|--------|--------|------|------|------|----------|
| 🔴 高 | 🔵 High | file1.tsx:42 | 安全 | 描述 | ✅ |
| 🟡 中 | 🟠 Medium | file2.tsx:18 | 运行时 | 描述 | — |

## 测试建议 [REQUIRED]
1. 测试场景
2. 测试场景

## GH 评论操作 [REQUIRED if qualifying findings exist, OMIT if none]
以下问题（🔵 High 置信度 + 🟡 中及以上）建议直接评论到 PR：
- [ ] 问题1 — `file.tsx:42`
- [ ] 问题2 — `file.tsx:88`

> 确认后将通过 `gh` CLI 发送 inline comments。
```

## Priority Definitions

| Priority | Criteria | Action |
|----------|----------|--------|
| **🔴 高** | Build failure, security vulnerability, data loss, crash | Must fix before merge |
| **🟡 中** | Runtime bug, incorrect behavior, maintainability | Should fix before merge |
| **🟢 低** | Nice-to-have, minor inconsistency | Can fix in follow-up |

## Review Discipline

- **Read the code** — don't just grep. Read each changed file to understand intent.
- **No false positives** — only report issues you're confident about. Uncertain? Lower the confidence.
- **No style nitpicks** — focus on security, correctness, architecture, performance.
- **Context matters** — understand why the code was written this way before suggesting changes.
- **Prioritize** — 3 high-quality findings beats 20 marginal complaints.
- **Score honestly** — the score reflects reality, not diplomacy.
- **Auto-fix aggressively** — when the fix is clear, always include a diff patch. Reviewers prefer actionable suggestions.

## Reference Files

- [references/security-and-supply-chain.md](references/security-and-supply-chain.md) — PII leakage, AuthN/AuthZ, supply-chain, manifest permissions
- [references/code-quality-patterns.md](references/code-quality-patterns.md) — Hooks, race conditions, null safety, concurrent requests, error handling
- [references/onekey-platform-patterns.md](references/onekey-platform-patterns.md) — Android/iOS crashes, Fabric, BigNumber, build/CI
- [references/quick-commands.md](references/quick-commands.md) — Bash one-liners for automated checking
