---
name: pr-review
description: Security-first PR review checklist for this repo. Use when reviewing diffs/PRs, especially changes involving auth, networking, sensitive data, or dependency/lockfile updates. Focus on secret/PII leakage risk, supply-chain risk (npm + node_modules inspection), cross-platform architecture (extension/mobile/desktop/web), and React performance (hooks + re-render hotspots). Avoid UI style nitpicks. PR Review.
allowed-tools: Read, Grep, Glob, Bash
---

# Secure PR Review

**输出语言**: 使用中文输出所有审查报告内容。

Follow this workflow when reviewing code changes. Prioritize **security > correctness > architecture > performance**.

---

## Core Review Principles

Before diving into the checklist, internalize these principles:

1. **"改善代码健康度"原则**（Google Eng-Practices）: 只要变更整体上改善了代码质量，就应该通过审查——即使它并不完美。不要因为追求完美而阻塞合并。
2. **先看测试，再看实现**: 测试揭示了作者的意图。先理解"要做什么"，再评估"怎么做的"。
3. **聚焦高价值问题**: 安全、正确性、架构问题 > 风格偏好。不要在 P3 级问题上纠缠。
4. **每条反馈都要可行动**: 使用 "Issue → Suggestion → Why" 格式，让作者知道问题是什么、建议怎么改、为什么要改。
5. **减少噪音**: 只报告 >80% 置信度的真实问题，60-80% 标记为 Question。不确定的就别说。

---

## Severity Levels

All findings MUST be classified using the following severity levels:

| Level | Name | Definition | Action |
|-------|------|------------|--------|
| **P0** | Critical | Security vulnerabilities, data loss, correctness bugs that block merge | Must fix before merge |
| **P1** | High | Logic errors, SOLID violations, performance regressions, auth/crypto issues | Should fix before merge |
| **P2** | Medium | Code smells, maintainability concerns, missing edge cases | Fix or create follow-up issue |
| **P3** | Low | Style, naming, minor suggestions | Optional, author's discretion |

## Confidence Threshold

Only report findings with **>80% confidence** of being a real issue. Explicitly exclude:
- Subjective style preferences (unless violating project CLAUDE.md rules)
- Hypothetical issues dependent on unknown runtime conditions
- DOS/rate-limiting (handled by infra)
- Stored secrets on disk (handled by separate tooling)

When confidence is borderline (60-80%), flag as **Question** instead of a finding.

---

## Review Depth Modes

Choose the appropriate review depth based on the PR's risk level:

| Mode | When to Use | Scope | Time |
|------|-------------|-------|------|
| **Quick** | Config/docs/style-only changes, <50 lines | Diff-only: only review changed lines | ~5 min |
| **Standard** | Normal feature/bugfix PRs | Changed files: review full context of changed files | ~15 min |
| **Deep** | Security-critical, crypto, auth, dependency updates | Full context: trace call chains, inspect node_modules, cross-reference consumers | ~30+ min |

Auto-select rule:
- Touching `packages/core`, `**/vault/**`, `**/signing/**`, `**/auth/**`, `package.json`, `yarn.lock` → **Deep**
- Touching `packages/kit`, `packages/kit-bg`, `packages/components` → **Standard**
- Docs, config, comments, type-only → **Quick**

---

## Review scope (base branch)

- Treat `x` as the base (main) branch.
- Use PR semantics: `git fetch origin && git diff origin/x...HEAD` (triple-dot).

---

## Review Order (IMPORTANT)

Follow this order for maximum efficiency:

1. **Tests first** — Read new/modified tests to understand the author's intent
2. **High-risk files** — Security-critical, auth, crypto, dependency changes
3. **Core logic** — Business logic, state management, services
4. **UI components** — React components, styles
5. **Config/docs** — Package.json, manifests, documentation

This order ensures you understand "what" before evaluating "how", and catch critical issues early.

---

## Phase 1: Preflight Context (REQUIRED)

Before reviewing any code, gather context to scope the review correctly.

### 1.0 Identify Entry Points & Boundaries

```bash
git fetch origin && git diff --name-only origin/x...HEAD
git diff --stat origin/x...HEAD
```

- Identify which packages are touched (shared / components / core / kit-bg / kit / apps)
- Identify risk areas: auth flows, signing/keys, networking, analytics, storage, dependency updates
- Identify ownership boundaries: which teams/modules own the changed code
- **Determine Review Depth Mode**: Quick / Standard / Deep based on risk level

### 1.1 File Change Inventory (REQUIRED)

Generate a structured overview of ALL changed files:

```markdown
## PR File Structure Analysis

**Review Depth**: Quick | Standard | Deep
**Reason**: [why this depth was chosen]

### Changed Files Summary
| File | Change Type | Category | Risk Level | Description |
|------|-------------|----------|------------|-------------|
| `path/to/file.ts` | Added/Modified/Deleted | UI/Logic/API/Config/Test | Low/Medium/High/Critical | Brief description |

### Files by Category

#### 🔐 Security-Critical Files
- Files touching auth, crypto, keys, secrets

#### 🌐 API/Network Files
- Files with network requests, API calls

#### 🧩 Business Logic Files
- Core logic, state management, services

#### 🎨 UI Component Files
- React components, styles, layouts

#### ⚙️ Configuration Files
- package.json, configs, manifests

#### 🧪 Test Files
- Unit tests, integration tests

#### 📦 Dependency Changes
- package.json, lockfile changes
```

### 1.2 Per-File Analysis (REQUIRED for Standard/Deep mode; OPTIONAL for Quick)

For EACH changed file, provide:

```markdown
### `path/to/file.ts`
**Change Type**: Added | Modified | Deleted
**Lines Changed**: +XX / -YY
**Category**: UI | Logic | API | Config | Test
**Risk Level**: Low | Medium | High | Critical

**What This File Does**:
- Primary responsibility of this file

**Changes Made**:
1. Specific change 1
2. Specific change 2

**Dependencies**:
- Imports from: [list key imports]
- Exported to: [list files that import this]

**Security Considerations**:
- Any security-relevant aspects

**Cross-Platform Impact**:
- [ ] Extension
- [ ] Mobile (iOS/Android)
- [ ] Desktop
- [ ] Web
```

---

## Phase 2: Multi-Dimensional Review

Run all applicable review dimensions in parallel. Each dimension produces findings tagged with severity (P0-P3) and confidence (%).

### 2.1 Security Review (3-Phase Methodology)

Adopt the **context → compare → assess** methodology:

#### Phase A: Repository Context Research
- Identify existing security frameworks, libraries, and secure coding patterns in the codebase
- Understand the project's authentication model, encryption approach, and trust boundaries
- Note established patterns that new code should follow

#### Phase B: Comparative Analysis
- Compare new/changed code against established security patterns
- Flag deviations from existing security practices
- Check if security-related changes maintain consistency with the rest of the codebase

#### Phase C: Vulnerability Assessment
- Trace data flow from user input to sensitive operations
- Examine modified files for injection points and security implications
- Only flag issues with **>80% confidence** of real exploitation potential

#### 2.1.1 Secrets / PII / Privacy (MUST)

- Do not allow logs/telemetry/error reports to include: mnemonics/seed phrases, private keys, signing payloads, API keys, tokens, cookies, session IDs, addresses tied to identity, or any PII.
- Inspect all "exfil paths": `console.*`, logging utilities, analytics SDKs, error reporting, network requests, and persistence:
  - Web: localStorage / IndexedDB
  - RN: AsyncStorage / secure storage
  - Desktop: filesystem / keychain / sqlite
- If any potential leak exists, document: **source**, **sink**, **trigger**, **impact**, **fix**.

#### 2.1.2 AuthN / AuthZ (MUST)

- Verify authentication middleware/guards wrap every protected route and cannot be bypassed.
- Verify authorization checks (roles/permissions) are correct and consistent.
- Verify server/client trust boundaries: never trust client input for authorization decisions.

#### 2.1.3 Input Validation & Injection

Focus on high-confidence vulnerabilities:
- SQL injection, command injection, XXE, template injection, NoSQL injection, path traversal
- Deserialization vulnerabilities (pickle, YAML, JSON with custom revivers)
- eval/new Function/dynamic require usage
- XSS (especially in WebView and extension contexts)

#### 2.1.4 Cryptography & Secrets Management

- Hardcoded credentials or API keys
- Weak algorithms or deprecated crypto functions
- Improper key storage or transmission
- JWT validation bypass opportunities

### 2.2 Design & Complexity (Google Eng-Practices)

Evaluate changes through two lenses:

#### Design
- Is the overall design well-thought-out?
- Does this change belong in this codebase, or should it be in a library/separate package?
- How do the changed pieces interact with each other and existing code?

#### Complexity / Over-engineering
- Is the code more complex than necessary at any level (line, function, class)?
- Are developers solving speculative future problems instead of actual current needs?
- Can a future developer easily understand and modify this code?
- Flag "clever" code that sacrifices readability for brevity

### 2.3 SOLID & Architecture Review

Check for design principle violations in changed code:

| Principle | What to Check |
|-----------|---------------|
| **SRP** | Does each changed class/module have a single reason to change? |
| **OCP** | Are changes extending behavior via abstraction or modifying existing code? |
| **LSP** | Do subtype changes maintain behavioral compatibility? |
| **ISP** | Are interfaces fat? Do consumers depend on methods they don't use? |
| **DIP** | Do high-level modules depend on abstractions or concrete implementations? |

Also check for:
- **God functions** (>40 lines without clear justification)
- **Feature envy** (a function that uses more data from another module than its own)
- **Shotgun surgery** (one change requires modifying many unrelated files)
- **Import hierarchy violations** (CRITICAL for this monorepo):
  - `shared` → imports nothing from OneKey
  - `components` → only `shared`
  - `kit-bg` → only `shared` + `core` (NEVER `components` or `kit`)
  - `kit` → `shared` + `components` + `kit-bg`

### 2.4 Removal Candidates

Identify code that should be removed or cleaned up:

- **Dead code**: Functions/components/exports no longer called after this change
- **Redundant code**: Duplicated logic that could be extracted into a shared utility
- **Feature-flagged code**: Stale feature flags that should be cleaned up
- **TODO/FIXME**: New TODOs added without tracking issues

For each removal candidate, provide:
```markdown
**File**: `path/to/file.ts:L42`
**Type**: Dead code | Redundant | Stale flag | Untracked TODO
**Suggestion**: Remove / Extract / Create issue
**Confidence**: XX%
```

### 2.5 Dependency & Supply-Chain Security (HIGHEST PRIORITY)

If `package.json` / lockfiles changed, you MUST do all of the following:

#### 2.5.1 Enumerate changes
- List every added/updated/removed dependency with **name + from→to version** and the reason.

#### 2.5.2 Quick ecosystem risk check
- For each changed package: check for recent maintainer/ownership changes, suspicious release cadence, known advisories/CVEs, typosquatting risk.
- Run: `npm view <pkg> time maintainers repository dist.tarball`

#### 2.5.3 Source inspection (node_modules)
- Inspect `node_modules/<pkg>/package.json` and entrypoints.
- Grep for high-risk behavior:
  - Outbound/network: `fetch(`, `axios`, `XMLHttpRequest`, `http`, `https`, `ws`
  - Dynamic execution: `eval`, `new Function`, dynamic `require`
  - Install hooks: `postinstall`, `preinstall`, binary downloads
  - Privilege access: filesystem, clipboard, keychain, environment variables
- Treat as **P0** and block unless justified + isolated.

#### 2.5.4 React Native native-layer inspection (for RN libs)
- Inspect iOS/Android native sources for security + performance.
- Confirm no unexpected outbound requests, no telemetry, no access to wallet secrets.

#### 2.5.5 Extension manifest permissions (HIGHEST PRIORITY)
- If `manifest.json` permissions change: enumerate added/removed permissions, assess least-privilege, re-check data exposure surfaces.

### 2.6 Cross-Platform Architecture Review

Review as a senior multi-platform architect:
- Is this the simplest correct solution?
- Platform pitfalls:
  - Extension: MV3/service worker lifetimes, permissions, CSP
  - RN: WebView, native modules, backgrounding, secure storage
  - Desktop: Electron security boundaries, IPC, nodeIntegration
  - Web: CORS, storage, XSS, bundle size
- If not optimal, propose alternative with tradeoffs.

### 2.7 React Performance (Hooks + Re-render Hotspots)

For new/modified components:
- Unnecessary re-renders from unstable references (inline objects/functions)
- Incorrect hook dependency arrays (missing deps → stale closures; extra deps → effect churn)
- State placed too high causing wide re-render fanout
- Memoization correctness (`memo`, `useMemo`, `useCallback`)
- Expensive work in render, list rendering issues, missing cleanup
- Apply stricter scrutiny to **new parent/child boundaries**

### 2.8 Code Quality Scan

- **Boundary conditions**: off-by-one, null/undefined vs empty, integer overflow
- **Error handling**: uncaught promises, missing try/catch, error swallowing
- **Race conditions**: concurrent async operations, state updates after unmount
- **Memory leaks**: unsubscribed listeners, uncancelled timers, retained closures
- **Type safety**: `any` usage, type assertions without validation, `@ts-ignore`
- **Naming**: variables/functions have clear, descriptive names that reveal intent
- **Documentation**: public APIs and non-obvious logic have adequate comments (in English)

### 2.9 Test Coverage Review

Review tests with the same rigor as production code:
- Are the right kinds of tests added (unit / integration / e2e)?
- Do tests actually assert the behavior introduced in this PR?
- Will tests fail if the code breaks? (no tautological or always-passing tests)
- Are edge cases tested (null, empty, error, boundary values)?
- Do tests follow existing project test patterns and naming conventions?

---

## Phase 3: Structured Output (REQUIRED)

### 3.1 Findings Table (with Inline Suggestions)

Organize all findings by severity. Each finding MUST use the **Issue → Suggestion → Why** format:

```markdown
## Review Findings

### P0 — Critical (Must Fix)
| # | File:Line | Category | Confidence |
|---|-----------|----------|------------|

**Finding 1**: `path/to/file.ts:L42`
- **Issue**: [What is wrong]
- **Suggestion**: [Concrete fix with code snippet]
  ```typescript
  // Before
  const key = userInput;
  // After (suggested fix)
  const key = sanitize(userInput);
  ```
- **Why**: [Explanation of the risk/impact]

### P1 — High (Should Fix)
...

### P2 — Medium (Fix or Follow-up)
...

### P3 — Low (Optional)
...

### Questions (Need Clarification)
| # | File:Line | Question | Context |
|---|-----------|----------|---------|
```

### 3.2 Verdict

```markdown
## Verdict

**Decision**: ✅ Approve | ⚠️ Approve with comments | 🚫 Request changes
**P0 count**: X | **P1 count**: X | **P2 count**: X | **P3 count**: X
**Blocking issues**: [list P0s if any]
**Risk assessment**: Low / Medium / High / Critical
**Review depth used**: Quick / Standard / Deep
```

Rules:
- Any P0 → **Request changes**
- P1 only → **Approve with comments** (strongly recommend fixing)
- P2/P3 only → **Approve with comments**
- No findings → **Approve**

Remember: approve if the change **improves overall code health**, even if it's not perfect.

### 3.3 Architecture Visualization (REQUIRED for Standard/Deep mode)

Generate at least 2 ASCII diagrams:

#### File Dependency Graph (always)

```text
┌─────────────────────┐     ┌─────────────────────┐
│   package.json      │────▶│     yarn.lock       │
└─────────────────────┘     └─────────────────────┘
```

#### Domain-Specific Diagram (pick most relevant)

- **Data Flow**: User Input → Validation → Logic → API → State → UI
- **Component Hierarchy**: Parent → Children tree with props
- **State Flow**: State machine with transitions
- **Sequence Diagram**: Async operation timeline

#### Cross-Platform Impact Matrix (always)

```text
Platform Impact:
┌───────────┬───────────┬───────────┬───────────┐
│ Extension │  Mobile   │  Desktop  │    Web    │
├───────────┼───────────┼───────────┼───────────┤
│     ✓     │     ✓     │     ✓     │     ✓     │
└───────────┴───────────┴───────────┴───────────┘
Risk Level:  [HIGH]      [HIGH]      [MEDIUM]    [LOW]
```

Diagram guidelines:
- Use box-drawing characters: `┌ ┐ └ ┘ │ ─ ├ ┤ ┬ ┴ ┼ ▶ ◀ ▲ ▼ ✓ ✗`
- Use `[HIGH]` `[MEDIUM]` `[LOW]` labels
- Max 10-15 nodes per diagram; split complex flows into multiple diagrams

---

## Incremental Re-review (for PR Updates)

When code is pushed to update an existing PR:

1. Only re-review files that changed since your last review
2. Verify previously flagged P0/P1 issues have been addressed
3. Check that fixes don't introduce new issues
4. Update your verdict based on the current state

```bash
# View changes since last review
git diff <last-reviewed-commit>...HEAD --name-only
```

---

## Review Anti-patterns (DO NOT DO THESE)

| Anti-pattern | Why It's Bad | Do This Instead |
|--------------|-------------|-----------------|
| Blocking on style nitpicks | Wastes time, demoralizes author | Use P3 or skip entirely |
| Demanding perfection | Delays value delivery | Approve if it improves code health |
| Vague feedback ("this is wrong") | Author can't act on it | Use Issue → Suggestion → Why format |
| Reviewing >400 lines at once | Attention fatigue, missed issues | Ask author to split the PR |
| Ignoring tests | Missed intent, missed regressions | Always review tests first |
| Rubber-stamping | Security/correctness risks slip through | Spend real time proportional to risk |
| Reviewing after days of delay | Blocks author, context loss | Target first review within 4 hours |

---

## Standards Maintenance

Review this checklist quarterly to keep it relevant:
- Archive checks that never catch real issues
- Add checks for recurring bug patterns from `.claude/skills/1k-retrospective/references/case-studies.md`
- Update for new platform constraints or security requirements

---

## Additional resources

- Security patterns: [reference/security-patterns.md](reference/security-patterns.md)
- Dependency audit: [reference/dependency-audit.md](reference/dependency-audit.md)
- React performance: [reference/react-performance.md](reference/react-performance.md)
- Cross-platform checks: [reference/cross-platform.md](reference/cross-platform.md)
- File analysis patterns: [reference/file-analysis.md](reference/file-analysis.md)
