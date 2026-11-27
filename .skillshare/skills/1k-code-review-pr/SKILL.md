---
name: 1k-code-review-pr
description: Review OneKey PRs and diffs for security, correctness, concurrency, React/RN pitfalls, and repository-specific regressions. Use for code review or 审查 PR.
allowed-tools: Read, Grep, Glob, Bash, WebFetch
---

# OneKey PR Code Review

**输出语言**: 中文

## Review Scope

- Default base branch: `x`; use the actual base for a specified PR.
- For a specified PR, read its current base/head and diff with `gh pr view`
  and `gh pr diff`; do not assume the active branch is the PR head.
- For a local review, honor the requested worktree, staged, or branch scope
  and report the exact comparison. Branch comparisons do not include
  uncommitted work.
- Initialize `review_diff` and `review_file` using the selected scope in
  [quick-commands.md](references/quick-commands.md#select-the-review-scope).
  All checks and linked guides must use those same inputs. Read surrounding
  code from the reviewed commit, index, or worktree as appropriate.
- Source review is read-only unless edits are requested. Publishing comments
  is a separate action: follow the existing standing workflow authorization
  only within its agreed target and limits. An explicit request for local-only
  results or no posting takes precedence. Skill steps do not grant permission.

## Workflow

For a local diff without a specified PR, skip PR metadata, existing-comment
queries, and publishing. Use a local-review title and omit PR-only report fields
or mark them not applicable; retain findings, evidence, scoring, and validation.

1. **Inspect Target** — Read the requested PR or local diff without switching
   the active checkout. If source inspection requires a checkout, use an
   isolated worktree and preserve the user's active workspace.
2. **Characterize First (PR 定性先行)** — Before reading line-by-line, classify the
   PR into one primary type and blast radius (see **PR Characterization &
   Dynamic Focus** below). Let the PR type govern what you prioritize and what
   you explicitly skip.
3. **Scope & Triage** — Inspect the selected diff's changed files, change size,
   and load only the matching review modules from the triage table.
4. **Context-Grounded Primary Review** — Read each changed file in full repo
   context (not the diff in isolation), applying the PR-type focus areas and
   relevant checks from `references/`.
5. **Codex Cross-Review** — If Codex available, run full parallel review (see below)
6. **PR Comment Analysis** — For a specified PR, fetch existing comments
   (bot + human) and analyze them against the reviewed source (see below)
7. **Merge & Filter Findings** — Combine primary + Codex + PR comment findings,
   deduplicate, apply **Hard Negative Constraints** (auto-drop forbidden noise),
   and annotate confidence.
8. **Score** — Rate the PR across 4 dimensions (see Scoring System). **This step is MANDATORY — every report MUST include the scoring table.**
9. **Report** — Generate structured report using the unified format. **Follow the template exactly — every section is required.**
10. **GH Comment** — When publishing is authorized for this PR, post qualifying
    inline comments (within the hard comment cap) without reconfirming.
    Otherwise return findings locally.

Do not run `agent:check --profile commit` or `--profile pr` for read-only review;
both can auto-fix worktree files. For remote status use `--profile ci --pr <N>`
(writes local logs), or read GitHub status directly.

## Codex Cross-Review Integration

Check if Codex is available by confirming the `codex:codex-rescue` subagent type can be dispatched. If uncertain, invoke `/codex:setup` to check readiness.

**If available:**
1. Dispatch a full independent review to Codex via `Agent(subagent_type="codex:codex-rescue")`:
   ```
   Agent(
     subagent_type = "codex:codex-rescue",
     prompt = "Review this PR diff for the OneKey crypto wallet monorepo. Focus on:
   - Security vulnerabilities (secret leakage, auth bypass, supply-chain risks)
   - Runtime bugs (race conditions, null safety, memory leaks)
   - Architecture violations (import hierarchy, cross-platform issues)
   - Code quality (hooks safety, error handling, performance)
   Report each finding with: file:line, severity (Critical/High/Medium/Low), description, fix suggestion.

   Diff:
   ${FULL_DIFF}"
   )
   ```
2. Parse Agent result for structured findings
3. Merge into primary review:
   - **Both found same issue** → Mark `{Cross-validated ✅}`; assign confidence from evidence, not agreement alone
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
| **📋 Already Covered** | Your primary review caught it | Record both sources; assess supporting evidence |

**Your local advantages — use them aggressively:**
- **Full source** — trace data flow across files, not just the diff
- **Type system** — run `yarn tsc` (TypeScript 7 native), verify types end-to-end
- **Architecture** — you know OneKey's import hierarchy and platform patterns
- **Dependencies** — `yarn info`, changelogs, actual vulnerability reachability
- **Runtime reasoning** — state flows, async lifecycles, race conditions

When someone flags something vague, dig into the source to confirm or refute. When a comment misses context (e.g., a function is safely guarded upstream), explain why. When a comment is right, amplify with richer context.

### Cross-Validation Rules

- Comment + primary review agree → Mark `{Cross-validated ✅}`; verify the claim against the reviewed source before assigning confidence
- Comment-only finding you confirm → Include at appropriate confidence with `[<author>]` tag
- Comment-only finding you can't confirm or refute → Include as ⚪ Low with note
- Comment you refute with evidence → Add to "评论误报分析" section

### Security Comment Special Handling

For security-related comments (from bots like Snyk/Dependabot or from human reviewers):
- **Vulnerability reports** — check if the vulnerable code path is actually reachable in OneKey's usage
- **License issues** — verify against OneKey's license policy
- **Dependency alerts** — check if the flagged version is actually used (not just in lockfile)

## PR Characterization & Dynamic Focus (MANDATORY FIRST STEP)

Before inspecting individual lines, read the PR title, description, linked ticket, and changed file list to classify the PR into **one primary type**. Your review effort must concentrate on that type's highest-leverage risks rather than running a flat line-by-line nitpick pass:

1. **Revert / Rollback (`revert:`)**
   - **ONLY check**: Is the revert complete? Are lockfiles (`yarn.lock`, `Podfile.lock`), native podspecs, `apps/mobile/bundle-registry/module-id-registry.json`, and build configs consistent? Does it break compilation, startup, or persisted data schema compatibility?
   - **STRICTLY FORBIDDEN**: Reviewing pre-existing code being restored (UI polish, edge cases, a11y, refactors).
2. **Dependency / Release / Config Chore (`chore(deps)`, version bump, CI)**
   - **ONLY check**: Supply-chain risk, breaking peer/native dependency mismatches, missing lockfile/`Podfile.lock` sync, and build/bundle regressions.
3. **Cross-Platform Migration / UI Infrastructure / Refactor** (e.g., migrating to `NativeList`, `AppPager`, shared layout, native view modules)
   - **PRIMARY FOCUS**:
     - **Cross-platform isomorphism (三端同构)**: Are iOS / Android / Web / Desktop truly unified, or did the PR introduce parallel abstractions, reverse-bridging to deprecated contexts (e.g., `TabsContext`), or platform-specific workarounds?
     - **Half-migration & legacy drift**: Did it leave legacy paths (`legacy*`, old `Tabs.ScrollView`, parallel entry points) partially migrated or diverged?
     - **Code duplication & reuse-first**: Search the repo before accepting new helpers, patch planners, formatters, or state machines. Flag repeated copy-paste implementations and cross-domain imports (e.g., Market importing `views/Home/hooks/*`) with exact reuse targets.
     - **Runtime & native boundary semantics**: Split-heap `main` vs `bg` assumptions (iOS/Android/Extension) vs single-runtime (Desktop/Web), native view recycling/memory leaks, gesture/scroll-lock semantic regressions (e.g., `pointerEvents="none"` replacing `scrollEnabled`), and strict Metro `module-id-registry.json` registration.
4. **Core Feature / Business Logic / Crypto / Signing / Trade / Storage**
   - **PRIMARY FOCUS**:
     - **Security & funds safety**: Key/mnemonic/PII leakage, deterministic serialization (`stringUtils.stableStringify()`), auth/origin/CSP/risk-check bypass, unvalidated external input.
     - **Data & state integrity**: Realm/IndexedDB schema migrations (`LOCAL_DB_VERSION`), race conditions in financial/async flows, stale closures or out-of-order responses that corrupt balance/order/tx state.
     - **Concrete failure modes**: Reproducible runtime crashes, unhandled rejections on critical paths, and memory/subscription leaks.
5. **Targeted Bugfix (`fix:`)**
   - **PRIMARY FOCUS**: Does it fix the root cause (not a symptom band-aid)? Does it break adjacent flows or sibling platforms (`.native.ts`, `.ios.ts`, `.android.ts`, `.web.ts`, `.desktop.ts`, `.ext.ts`)? Are there state/lifecycle side effects?

## Hard Negative Constraints (AUTO-DROP)

NEVER report or post comments about any of the following **unless the PR's explicit stated goal is specifically about that topic**:

1. **Accessibility / Assistive Tech / Motion nitpicks**: VoiceOver, TalkBack, screen readers, `accessibilityLabel`, `accessibilityRole`, `aria-*`, `spoken text`, `Reduce Motion`, keyboard tab order / focus rings on non-a11y PRs, and foldable hinge / separating pane edge cases.
2. **Speculative `Confirm / Verify / Check` questions**: Never emit `[Confirm whether ...]`, `[Verify that ...]`, or `[Check if ...]`. If you cannot prove a concrete failure path or architectural/duplication defect from repository source, drop the finding.
3. **Pre-existing issues**: Do not flag bugs, missing error handling, or legacy patterns in untouched code unless this PR directly introduces or worsens the failure.
4. **Product / scope second-guessing**: Do not ask the author to add extra chains, platforms, or features that are intentionally out of scope.
5. **Follow-up review-fix spirals**: When reviewing subsequent commits on an already-reviewed PR, ONLY verify whether previous P0/P1 findings were fixed cleanly and whether the new diff introduced a P0/P1 regression. Do NOT invent new P2 edge cases on fix commits.

## Triage: Which Checks to Run

List changed files from the selected PR or local diff and match:

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
- Avoidable reimplementation when stable existing helpers, hooks, services, or components already cover the same behavior (see below)
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
# Inspect imports from the selected scope and source version
review_diff --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' |
  while IFS= read -r f; do
    printf '%s\n' "$f"
    review_file "$f" | rg -n 'from.*@onekeyhq'
  done
```

## Existing Implementation Reuse (ALWAYS verify)

For newly added helpers, hooks, services, components, constants, formatters, validators, or business logic:
- Search the codebase for existing implementations with the same intent before accepting the new code.
- Prefer established OneKey APIs, components, hooks, utilities, and service methods over local reimplementation.
- Flag reimplementation only when the existing abstraction is semantically equivalent, stable, and does not introduce worse coupling.
- In each reuse finding, include the existing file/function to reuse and explain why it covers the new behavior.

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
| **💎 代码质量** | 30% | Hooks safety, error handling, race conditions, null safety, DRY, reuse of existing implementations |
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
- A single P0 security issue → Security capped at 3
- A single P0 crash/runtime bug → Code Quality capped at 5
- Import hierarchy violation → Architecture capped at 4

## Confidence Levels

**MANDATORY** — every finding must use exactly one of these three emoji tags. Do NOT use percentages, do NOT use plain text like "高/中/低" without the emoji. Always use this exact format:

| Tag | Meaning | When to use |
|-----|---------|-------------|
| **🔵 High** | Confirmed, verifiable from code | Clear bug, obvious violation, reproducible |
| **🟠 Medium** | Likely issue, needs context | Pattern suggests problem, might be intentional |
| **⚪ Low** | Possible issue, needs human check | Heuristic match, depends on business logic |

Agreement between reviewers records multiple sources; it does not establish
**🔵 High** confidence. High confidence requires a concrete execution path in
the reviewed code snapshot, a regression test, or reproduction evidence that confirms
the issue. State missing conditions when evidence is incomplete.

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
- **Clustered / state-inflating patches**: when a single file already has `>= 2` P0/P1 findings or fixing the finding would add another `useState`/`useRef`/boolean guard on top of an already complex flow, do NOT generate an additive local `Auto-fix` patch; instead recommend a convergent state-machine or boundary refactor that reduces net complexity.

## GH CLI Inline Comments

The existing automatic-comment workflow applies when user authorization covers
posting to the specified PR, including an applicable standing authorization.
Post qualifying findings in the same turn without reconfirming that permission.
If the current request prohibits posting or no publishing authorization applies,
return the findings locally. Reviewing a local diff alone does not identify an
authorized remote target. Publishing never authorizes source edits.

**Comment threshold**: P0 (any confidence) OR P1 with 🔵 High confidence. This means:
- All P0 findings (regardless of confidence)
- All P1 findings with 🔵 High confidence supported by current-head evidence
- Excludes: P2 findings, and P1 with 🟠 Medium or ⚪ Low confidence

For a P0 with incomplete evidence, explicitly state its confidence and the
conditions that still require verification in the posted comment.

1. List the qualifying findings that warrant PR comments
2. Post them in the same turn as the report, using `ManagePullRequest` `post_comment` (path + line) when available, otherwise:

```bash
# Inline comment on specific file:line
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --field body="**[P1] 问题标题**: 描述...

**建议修复:**
\`\`\`suggestion
修复代码
\`\`\`

_— Auto-review by Claude_" \
  --field path="path/to/file.tsx" \
  --field line=42 \
  --field side="RIGHT" \
  --field commit_id="{PR_HEAD_SHA}"
```

**Rules:**
- Resolve `{PR_HEAD_SHA}` from the specified PR; if its head changed since
  review, recheck the affected finding and diff location before posting.
- Post qualifying findings in the same turn when authorized for that PR
- Only post findings meeting the comment threshold (see above)
- Include auto-fix in `suggestion` block when available
- Maximum 5 inline comments per PR (default target: 0–3; only exceed 5 for genuinely distinct P0/P1 blockers)
- Silent pass: if no finding meets the comment threshold, do not manufacture low-value P2 comments to look busy — post zero inline comments
- GitHub can only attach review comments to lines in the PR diff; if the real site is unchanged, comment on the nearest changed line and name the unchanged site in the body
- If an existing inline thread already states the same issue, reply to that thread instead of opening a duplicate

## Unified Report Format

**CRITICAL: Follow this template exactly. Every section marked [REQUIRED] must appear in every report. Do not skip or reorder sections.**

```markdown
# PR #NUMBER 代码审查报告

## 审查概要 [REQUIRED]
- **PR 定性**: `[类型]` 一句话概括 PR 真实意图、本次审查重点（及主动跳过的低信号项）
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

### [P0] [🔵 High] 问题标题 {Cross-validated ✅}
**文件**: `path/to/file.tsx:42`
**类型**: 安全 / 构建 / 运行时 / 性能 / 规范
**描述**: 问题是什么，为什么有风险
**Auto-fix:**
\```diff
- old code
+ new code
\```

---

### [P1] [🟠 Medium] 问题标题
**文件**: `path/to/file.tsx:18`
**类型**: 运行时
**描述**: ...
**修复建议**: ...

---

## 修改清单 [REQUIRED]

| 优先级 | 置信度 | 文件 | 类型 | 描述 | Auto-fix |
|--------|--------|------|------|------|----------|
| P0 | 🔵 High | file1.tsx:42 | 安全 | 描述 | ✅ |
| P1 | 🟠 Medium | file2.tsx:18 | 运行时 | 描述 | — |

## 测试建议 [REQUIRED]
1. 测试场景
2. 测试场景

## GH 评论操作 [REQUIRED if qualifying findings exist, OMIT if none]
报告每项问题的实际状态：已发布（附评论链接）、已有评论覆盖、仅本地输出或发布失败（说明原因）。
仅在工具结果确认发布成功后，才标记为已发布。
```

## Priority Definitions

**MANDATORY** — every finding must carry exactly one `P0`–`P2` tag as its priority. Do NOT use 高/中/低 or Critical/High/Medium/Low as finding priority labels.

| Priority | Criteria | Action |
|----------|----------|--------|
| **P0** | Security vulnerability, key/fund exposure, data loss, crash, runtime bug affecting users, build failure | Blocker — must fix before merge |
| **P1** | Edge-case bug, concurrency risk, robustness gap, maintainability problem | Should fix before merge |
| **P2** | Nice-to-have, minor inconsistency, nit (naming, comments, style) | Follow-up / optional |

Historical PR threads may still use the legacy 5-tier scale; when analyzing them, map old P1 → P0, old P2 → P1, old P3/P4 → P2.

## Review Discipline

- **Characterize before scanning** — identify what the PR is actually trying to achieve first; never audit a `revert` PR like a new feature or drown a cross-platform migration in local micro-edge-cases while missing structural divergence.
- **Read the code** — don't just grep. Read each changed file and sibling platform files to understand intent and full repo context.
- **No false positives or speculative questions** — only report issues you can prove from code; drop `[Confirm/Verify/Check ...]` guesses and low-signal noise.
- **No style or a11y nitpicks** — focus on security, correctness, cross-platform architecture, reuse, and real performance regressions; never inject VoiceOver/TalkBack/Reduce Motion/focus-ring nitpicks on non-a11y PRs.
- **Context matters** — understand why the code was written this way before suggesting changes.
- **Reuse first** — before accepting new abstractions or duplicated business logic, search for existing local implementations and flag unnecessary reimplementation with concrete reuse targets.
- **Prioritize** — 3 high-quality findings beats 20 marginal complaints.
- **Review-fix growth** — Report every verified defect at its actual priority. Use `yarn check:bloat` to guide fix suggestions, including whether several findings share a lifecycle or module boundary that should be refactored together.
- **Score honestly** — the score reflects reality, not diplomacy.
- **Auto-fix aggressively** — when the fix is clear, always include a diff patch. Reviewers prefer actionable suggestions.

## Reference Files

- [references/security-and-supply-chain.md](references/security-and-supply-chain.md) — PII leakage, AuthN/AuthZ, supply-chain, manifest permissions
- [references/code-quality-patterns.md](references/code-quality-patterns.md) — Hooks, race conditions, null safety, concurrent requests, error handling
- [references/onekey-platform-patterns.md](references/onekey-platform-patterns.md) — Android/iOS crashes, Fabric, BigNumber, build/CI
- [references/quick-commands.md](references/quick-commands.md) — Bash one-liners for automated checking
