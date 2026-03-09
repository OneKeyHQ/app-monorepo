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
3. **Triage** — Determine which review modules apply (see table below)
4. **Review** — Read each changed file, apply relevant checks from `references/`
5. **Report** — Generate structured report using the unified format below

## Triage: Which Checks to Run

Run `git diff origin/x...HEAD --name-only` and match against this table to decide which reference files to load:

| Changed Files Match | Load |
|---------------------|------|
| `package.json`, lockfiles, `node_modules` patches | [security-and-supply-chain.md] — full supply-chain review |
| `**/auth/**`, `**/vault/**`, `**/signing/**`, `**/crypto/**`, `manifest.json` | [security-and-supply-chain.md] — full security review |
| Any `.ts`/`.tsx` with business logic | [code-quality-patterns.md] — hooks, race conditions, null safety |
| `.android.ts`, `.ios.ts`, `.native.ts`, native modules, `BigNumber` usage | [onekey-platform-patterns.md] — platform crashes & numeric safety |
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
  xargs grep -l "from.*@onekeyhq" 2>/dev/null | \
  while read f; do echo "=== $f ==="; grep "from.*@onekeyhq" "$f"; done
```

## File Risk Classification

| Risk | Patterns | Action |
|------|----------|--------|
| **Critical** | `**/vault/**`, `**/signing/**`, `**/crypto/**`, `**/core/src/**`, hardware wallet SDK | Line-by-line review |
| **High** | `**/auth/**`, API endpoints, state management, `package.json`, `manifest.json` | Deep review |
| **Medium** | UI components, platform-specific code, background services | Standard review |
| **Low** | Comments, type-only, formatting, tests, docs | Scan for anomalies |

## Unified Report Format

ALL findings use this format — no per-section templates:

```markdown
# PR #NUMBER 代码审查报告

## 审查概要
- **变更范围**: X 个文件, +Y / -Z 行
- **风险等级**: Critical / High / Medium / Low
- **涉及平台**: Extension / Mobile / Desktop / Web

## 发现的问题

### [🔴 高] 问题标题
**文件**: `path/to/file.tsx:42`
**类型**: 安全 / 构建 / 运行时 / 性能 / 规范
**描述**: 问题是什么，为什么有风险
**修复方案**:
[具体代码修复]

---

### [🟡 中] 问题标题
...

## 修改清单
| 优先级 | 文件 | 类型 | 描述 |
|--------|------|------|------|
| 🔴 高 | file1.tsx:42 | 安全 | 描述 |
| 🟡 中 | file2.tsx:18 | 运行时 | 描述 |

## 测试建议
1. 测试场景
2. 测试场景
```

## Priority Definitions

| Priority | Criteria | Action |
|----------|----------|--------|
| **🔴 高** | Build failure, security vulnerability, data loss, crash | Must fix before merge |
| **🟡 中** | Runtime bug, incorrect behavior, maintainability | Should fix before merge |
| **🟢 低** | Nice-to-have, minor inconsistency | Can fix in follow-up |

## Review Discipline

- **Read the code** — don't just grep. Read each changed file to understand intent.
- **No false positives** — only report issues you're confident about. Uncertain? Mark as "Questions".
- **No style nitpicks** — focus on security, correctness, architecture, performance.
- **Context matters** — understand why the code was written this way before suggesting changes.
- **Prioritize** — a PR with 3 high-quality findings beats one with 20 marginal complaints.

## Reference Files

- [references/security-and-supply-chain.md](references/security-and-supply-chain.md) — PII leakage, AuthN/AuthZ, supply-chain, manifest permissions
- [references/code-quality-patterns.md](references/code-quality-patterns.md) — Hooks, race conditions, null safety, concurrent requests, error handling
- [references/onekey-platform-patterns.md](references/onekey-platform-patterns.md) — Android/iOS crashes, Fabric, BigNumber, build/CI
- [references/quick-commands.md](references/quick-commands.md) — Bash one-liners for automated checking
