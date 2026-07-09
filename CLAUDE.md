# Agent Instructions

OneKey is a TypeScript React/React Native monorepo for desktop, mobile, web,
and browser extension wallet apps. Keep changes scoped, typed, cross-platform
aware, and aligned with existing package boundaries.

## Core Rules

- Do not remove existing code/components unless the request explicitly requires it.
- TypeScript must stay precise: no fallback `never[]`, no avoidable `any`, and no
  `@ts-ignore` without documented justification.
- Prefer platform-specific files or `Platform.select` for platform behavior.
  Do not apply global CSS/style fixes for platform-specific bugs.
- All comments must be in English and explain non-obvious logic only.
- Never modify generated translations (`translations.ts`, locale JSON files).

## Runtime Model

Production native apps run two JS runtimes in the same native process:
`main` (UI) and `background` (bg). They have isolated JS heaps; JS objects are
not shared. Native resources such as MMKV, DB handles, file handles, and native
singletons may be shared underneath.

For any native, storage, state, memory, startup, or crash analysis, explicitly
state:

- Runtime scope: `main`, `bg`, or both.
- Native resource ownership: shared native instance or per-runtime instance.
- JS heap copies: whether data is deserialized once per runtime.
- Timing/order: bg and main initialize independently; do not assume readiness.

Every conclusion must label the runtime(s) it concerns and distinguish shared
native resources from per-runtime JS copies. main-JS and bg-JS bundles ship
version-locked; practical version skew is native-vs-JS, not bg-vs-main.

## Import Hierarchy

Never violate this dependency order:

- `@onekeyhq/shared`: must not import other OneKey packages.
- `@onekeyhq/components`: may import `shared` only.
- `@onekeyhq/kit-bg`: may import `shared` and `core` only; never `components`
  or `kit`.
- `@onekeyhq/kit`: may import `shared`, `components`, and `kit-bg`.
- Apps may import all packages.

## Security

- Never commit secrets, API keys, private keys, seeds, mnemonics, or sensitive
  user data.
- Never log sensitive data or bypass authentication, validation, CSP, transaction
  verification, or risk checks.
- Keep hardware wallet communication isolated in background processes.
- Do not modify cryptographic functions without deep security review.
- Use `stringUtils.stableStringify()` for deterministic crypto/hash/signature
  serialization; never use raw `JSON.stringify()` for those paths.

## Restricted Patterns

- Use `toLowerCase()` / `toUpperCase()`, never locale variants.
- Do not import `@onekeyfe/hd-core` directly; use `await CoreSDKLoader()`.
- Do not import `localDbInstance` directly; use `localDb`.
- Do not commit code that fails linting or TypeScript checks.

## Data And Dependencies

- Local DB schema changes must keep Realm and IndexedDB definitions in sync and
  bump `LOCAL_DB_VERSION` in `packages/kit-bg/src/dbs/local/consts.ts`.
- Schema changes include Realm properties, Realm record getters, IndexedDB store
  names/buckets, schema maps, and persisted model fields.
- For patch-package, edit files under `node_modules/`, regenerate with
  `npx patch-package <package-name>`, and verify patches exclude build artifacts.

## Debugging And Verification

- If a fix attempt fails, re-analyze the root cause from scratch; do not retry
  the same approach with small tweaks.
- For visual bugs, first confirm platform plus expected vs actual behavior.
- For Electron, DApp, UI, startup, and interaction fixes, state repro condition,
  what does not count as passing, and final pass condition before editing.
- Do not treat element existence as proof. Verify active tab state, real webview
  rendering, URL/title/content readiness, and console/log evidence where relevant.

## Git And Commands

- Base branch is `x`; never work directly on `x`.
- Commit format: `type: short description`.
- Do not add Co-Authored-By, Generated with, or tool attribution lines.
- Before commit: `yarn agent:check --profile commit`.
- Before PR readiness checks: `yarn agent:check --profile pr`.
- For remote-only CI/review status: `yarn agent:check --profile ci --pr <number>`.
- To reply to and resolve one review thread: list with
  `yarn agent:review-thread --pr <number> --list`, then run
  `yarn agent:review-thread --pr <number> --thread <thread-id> --reply-file <file>`.
- Use lower-level lint/typecheck/GitHub commands only when debugging a failed
  `agent:check` step; detailed logs are under `node_modules/.cache/agent-checks`.
- Use targeted tests when risk or scope requires them. Prefer explicit Jest paths,
  workspace test scripts, or documented scenario commands over the ambiguous root
  `yarn test` alias.

Common commands:

```bash
yarn app:desktop
yarn app:web
yarn app:ext
yarn app:ios
yarn app:android
yarn agent:check --profile commit
yarn agent:check --profile pr
yarn agent:check --profile ci --pr <number>
yarn agent:review-thread --pr <number> --list
```

## Skills And CLI

- Prefer repo skills in `.skillshare/skills` for detailed workflows such as
  architecture, i18n, cross-platform work, swap/market, bundle release, PRs,
  CI monitoring, and UI verification.
- `apps/cli/` has its own guidance. External OneKey wallet CLI skill packs live
  in `https://github.com/OneKeyHQ/onekey-wallet-skills`; do not re-add them to
  this monorepo.
