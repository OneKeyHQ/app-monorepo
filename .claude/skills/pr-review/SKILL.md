---
name: pr-review
description: Security-first PR review checklist for this repo. Use when reviewing diffs/PRs, especially changes involving auth, networking, sensitive data, or dependency/lockfile updates. Focus on secret/PII leakage risk, supply-chain risk (npm + node_modules inspection), cross-platform architecture (extension/mobile/desktop/web), and React performance (hooks + re-render hotspots). Avoid UI style nitpicks. PR Review.
allowed-tools: Read, Grep, Glob, Bash
---

# Secure PR Review

Follow this workflow when reviewing code changes. Prioritize **security > correctness > architecture > performance**.

## Review scope (base branch)
- Review scope: treat `x` as the base (main) branch. Always review the PR as the diff between the current branch (HEAD) and `x` (i.e., changes introduced by this branch vs `x`).
- Use PR semantics when generating the diff: `git fetch origin && git diff origin/x...HEAD` (triple-dot) to review only the changes introduced on this branch relative to `x`.

## 0) Scope the change
- Identify what changed (files, modules, entrypoints, routes/screens).
- Identify risk areas: auth flows, signing/keys, networking, analytics, storage, dependency updates.

## 1) Secrets / PII / privacy (MUST)
- Do not allow logs/telemetry/error reports to include: mnemonics/seed phrases, private keys, signing payloads, API keys, tokens, cookies, session IDs, addresses tied to identity, or any PII.
- Inspect all “exfil paths”: `console.*`, logging utilities, analytics SDKs, error reporting, network requests, and persistence:
  - Web: localStorage / IndexedDB
  - RN: AsyncStorage / secure storage
  - Desktop: filesystem / keychain / sqlite
- If any potential leak exists, explicitly document:
  - **source** (what sensitive data),
  - **sink** (where it goes),
  - **trigger** (when it happens),
  - **impact** (who/what is exposed),
  - **fix** (concrete remediation).

## 2) AuthN / AuthZ (MUST)
- Verify authentication middleware/guards wrap every protected route and cannot be bypassed.
- Verify authorization checks (roles/permissions) are correct and consistent.
- Verify server/client trust boundaries: never trust client input for authorization decisions.

## 3) Dependency & supply-chain security (HIGHEST PRIORITY)
If `package.json` / lockfiles changed, you MUST do all of the following:

### 3.1 Enumerate changes
- List every added/updated/removed dependency with **name + from→to version** and the reason (if stated in PR).

### 3.2 Quick ecosystem risk check (before approve)
- For each changed package:
  - check for recent maintainer/ownership changes, suspicious release cadence, known advisories/CVEs, typosquatting risk.
  - if your environment supports it, run commands like: `npm view <pkg> time maintainers repository dist.tarball`.

### 3.3 Source inspection (node_modules) — REQUIRED when risk is non-trivial
- Inspect the dependency’s `node_modules/<pkg>/package.json` and entrypoints (`main` / `module` / `exports`).
- Grep for high-risk behavior (examples; expand as needed):
  - outbound/network: `fetch(`, `axios`, `XMLHttpRequest`, `http`, `https`, `ws`, `request`, `net`, `dns`
  - dynamic execution: `eval`, `new Function`, dynamic `require`, remote script loading
  - install hooks: `postinstall`, `preinstall`, `install`, binary downloads
  - privilege access: filesystem, clipboard, keychain/keystore, environment variables
- Treat as **HIGH RISK** and block approval unless justified + isolated:
  - any telemetry / remote config fetch / unexpected outbound requests
  - any dynamic execution or install-time script behavior
  - any access to sensitive storage or wallet-related data

### 3.4 React Native native-layer inspection (REQUIRED for RN libraries)
- For React Native dependencies (or any package with native bindings: `.podspec`, `ios/`, `android/`, `react-native.config.js`, TurboModules/Fabric):
  - Inspect iOS/Android native sources for security + performance.
  - Confirm there are **no unexpected outbound requests**, no telemetry/upload without explicit product intent, and no access to wallet secrets/private keys/seed data.
  - If necessary, drill into third-party native dependencies:
    - iOS: CocoaPods / `Pods/` sources, vendored frameworks, build scripts
    - Android: Gradle/Maven artifacts, JNI/native libs, build-time tasks
  - Treat any hidden network behavior, dynamic loading, install/build scripts, or obfuscated native code as **HIGH RISK** unless explicitly justified and isolated.

## 4) Mandatory callout when node_modules performs outbound requests
If `node_modules` code performs **any** outbound network/API request (directly or indirectly), call it out clearly in the review:
- **exact call site** (file path + function)
- **destination** (full URL/host)
- **payload fields** (what data is sent)
- **headers/auth** (tokens/cookies/identifiers)
- **trigger conditions** (when/how it runs)
- **cross-platform impact** (extension/mobile/desktop/web)

## 4.1 Extension manifest permissions changes (HIGHEST PRIORITY)
- If `manifest.json` (`permissions`, `host_permissions`, `optional_permissions`) changes:
  - Call it out **prominently** as the top review item.
  - Enumerate added/removed permissions and explain what new capabilities they enable.
  - Assess least-privilege: confirm the permission is strictly necessary, scoped to minimal hosts, and does not broaden data access/exfil paths.
  - Re-check data exposure surfaces introduced by the permission change (network, storage, messaging, content scripts, background/service worker).

## 5) Cross-platform architecture review (extension/mobile/desktop/web)
Review the implementation as a senior multi-platform architect:
- Is the approach the simplest correct solution with good maintainability/testability?
- Identify platform pitfalls:
  - Extension constraints (MV3/service worker lifetimes, permissions, CSP)
  - RN constraints (WebView, native modules, backgrounding)
  - Desktop (Electron security boundaries, IPC, nodeIntegration)
  - Web (CORS, storage, XSS, bundle size, runtime differences)
- If not optimal, propose a better alternative with tradeoffs.

## 6) React performance (hooks + re-render hotspots)
For new/modified components:
- Check for unnecessary re-renders from unstable references:
  - inline objects/functions passed to children
  - incorrect hook dependency arrays
  - state placed too high causing wide re-render fanout
- Validate memoization strategy (`memo`, `useMemo`, `useCallback`) is correct (no stale closures / broken deps).
- Watch for expensive work in render, list rendering issues, and missing cleanup for subscriptions/listeners.
- Apply stricter scrutiny to **new parent/child boundaries** and call out any likely re-render hotspots.

## 7) Review output format (keep it actionable)
- Focus on security/correctness/architecture/performance.
- Avoid UI style / comment nitpicks unless they cause real bugs, security risk, or measurable perf regression.
- Provide findings as:
  - **Blockers** (must fix)
  - **High risk** (strongly recommended)
  - **Suggestions** (nice-to-have)
  - **Questions** (needs clarification)

## Additional resources
- Dependency audit: [reference/dependency-audit.md](reference/dependency-audit.md)
- React performance: [reference/react-performance.md](reference/react-performance.md)
- Cross-platform checks: [reference/cross-platform.md](reference/cross-platform.md)
