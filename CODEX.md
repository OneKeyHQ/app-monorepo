# CODEX.md

This file mirrors the expectations outlined in `CLAUDE.md`, but tailors them for the Codex CLI agent (GPT-based) that contributes to this repository.

## Repository Overview

OneKey is an open-source multi-chain crypto wallet that uses a monorepo structure to support desktop, mobile, web, and browser extension platforms. Development happens across Yarn workspaces with TypeScript, React, and React Native.

## CRITICAL: Ultrathink Mode for Complex Operations

Codex **MUST** enter Ultrathink mode whenever performing any of the following:
- Architectural refactors or introducing new cross-cutting abstractions
- Touching code that ships to multiple platforms simultaneously
- Editing cryptography, signing flows, or other security-sensitive modules
- Changing core packages (`packages/core`, `packages/kit`, `packages/shared`, etc.)
- Integrating with hardware wallets or low-level device bridges

### Ultrathink Analysis Framework

Before typing any code in these scenarios, work through this checklist:
1. **Dependency Impact Analysis** – Map upstream/downstream consumers of the files you plan to touch.
2. **Platform Compatibility Check** – Confirm desktop/mobile/web/extension implications.
3. **Security Risk Assessment** – Evaluate attack surface changes, data exposure, or permission shifts.
4. **Performance Impact Evaluation** – Gauge startup/runtime/memory effects.
5. **User Experience Impact** – Validate flows, fallbacks, and data integrity for end-users.

### Deep Verification Protocol

When Ultrathink mode is active, Codex must run:
- `yarn lint`
- `yarn tsc:only`
- All relevant unit/integration tests (`yarn test` or targeted suites)
- Circular dependency checks (part of `yarn tsc:only`, but reason explicitly)
- Manual verification on each affected platform when applicable

Only exit Ultrathink once every item passes with zero warnings.

### Quality Gate Requirements

Codex must halt and request clarification if any of these fail:
- Lint errors/warnings remain unresolved
- TypeScript compilation is not clean
- Security review identifies regressions
- Proposed change violates existing architecture or backward compatibility

## Branch Management
- Primary development branch: `x`
- Always branch from `x`. Never work directly on `x`, `onekey`, `master`, or `main`
- Standard workflow: `x` → feature branch → PR → merge back into `x`

## Development Commands

### App Entry Points
- `yarn app:desktop` – Electron dev server (30–60s). Troubleshoot via `yarn clean && yarn reinstall`.
- `yarn app:web` – Web dev server (port 3000). Ensure the port is free.
- `yarn app:ext` – Browser extension dev build.
- `yarn app:ios` / `yarn app:android` – React Native targets (requires native toolchains).
- `yarn app:web-embed` – Standalone component playground.

### Production Builds
- `yarn app:desktop:build`
- `yarn app:ext:build`
- `yarn app:web:build`
- `yarn app:native-bundle`

Always verify artifacts on their target platforms.

### Quality & Tooling
- `yarn lint` – **Mandatory** after any change. Allow up to 10 minutes.
- `yarn tsc:only` – Type checking to catch dependency loops and type issues.
- `yarn test` – Jest suite; never skip failures.
- Supporting commands: `yarn lint:only`, `yarn clean`, `yarn reinstall`.

Recommended workflow:
1. Implement change
2. `yarn tsc:only`
3. `yarn lint`
4. `yarn test`

## Architecture Overview

### Platform Folders
- `apps/desktop/`
- `apps/mobile/`
- `apps/ext/`
- `apps/web/`
- `apps/web-embed/`

### Core Packages
- `packages/core/`
- `packages/kit/`
- `packages/kit-bg/`
- `packages/components/`
- `packages/shared/`
- `packages/qr-wallet-sdk/`

### Patterns
- Tamagui-based cross-platform UI
- Platform-specific suffixes (`.native.tsx`, `.web.tsx`, etc.)
- Hardware wallet SDKs under `@onekeyfe/hd-*`
- Jotai for state management

## Code Organization & Import Hierarchy

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`

### Import Rules (STRICT)
1. `@onekeyhq/shared` – cannot import anything downstream
2. `@onekeyhq/components` – may only import from `shared`
3. `@onekeyhq/kit-bg` – may import from `shared` and `core`
4. `@onekeyhq/kit` – may import from `shared`, `components`, `kit-bg`
5. Apps – may import from all packages

Never violate upward imports or introduce circular dependencies. When in doubt, rerun `yarn tsc:only` and reconsider the design.

## Component Structure

- Keep platform-specific logic in suffix-based files rather than runtime branching whenever possible.
- Maintain parity between React (web) and React Native implementations.
- Use `platformEnv` from `@onekeyhq/shared` for legitimate runtime checks.

## Additional Expectations for Codex

- Mirror the tone and safety standards used by Claude: be explicit about assumptions, call out risks, and request user confirmation when ambiguity exists.
- Document rationale in PR descriptions or accompanying notes, especially when deviating from established patterns.
- Respect existing comment density: add clarifying comments only when truly helpful.
- When instructions from this document conflict with ad-hoc user requests, surface the conflict and wait for clarification.

By following the same high bar set for Claude—now formalized for Codex—you ensure consistent quality across all AI-assisted contributions to OneKey.
