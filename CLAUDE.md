# Agent Instructions

OneKey is a TypeScript React/RN monorepo (desktop, mobile, web, extension).
Keep changes scoped, typed, cross-platform aware, and within package boundaries.

## Core Rules

- Fix root causes. Preserve required behavior when replacing code.
- Keep TypeScript precise: no fallback `never[]`, avoidable `any`, or
  unjustified `@ts-ignore`.
- Use platform-specific files or `Platform.select` for platform behavior; do
  not apply global style fixes to platform-specific bugs.
- Write comments in English and only for non-obvious logic.
- Never modify generated translations (`translations.ts`, locale JSON files).

## Runtime Topology

Production runtime topology differs by target:

- iOS/Android/extension run `main` (UI) and `background` (`bg`) in isolated JS
  runtimes (separate JS heaps/objects; native MMKV/DB/singletons may still be
  shared).
- Desktop/web run `main` and `bg` in one JS runtime/thread (do not apply
  split-heap/per-runtime deserialization assumptions).

For native, storage, state, memory, startup, or crash analysis, state the target
platform first. On iOS/Android/extension, also state:

- Runtime scope: `main`, `bg`, or both.
- Native resource ownership: shared native instance or per-runtime instance.
- JS heap copies: whether data is deserialized once per runtime.
- Timing/order: `main` and `bg` initialize independently; do not assume readiness.

For desktop/web, label single-runtime and note native/process resources
separately. Split-runtime `main`/`bg` bundles ship version-locked (skew is
native-vs-JS, not `bg`-vs-`main`).

## Import Hierarchy

Never violate this dependency order:

- `@onekeyhq/shared`: no other OneKey packages.
- `@onekeyhq/components`: `shared` only.
- `@onekeyhq/kit-bg`: `shared` and `core` only; never `components` or `kit`.
- `@onekeyhq/kit`: `shared`, `components`, and `kit-bg`.
- Apps may import all packages.

## Security

- Never commit or log secrets, keys, seeds, mnemonics, or sensitive user data.
- Do not bypass authentication, validation, CSP, transaction verification, or
  risk checks.
- Keep hardware-wallet communication in background processes.
- Do not modify cryptographic functions without deep security review.
- Use `stringUtils.stableStringify()` for deterministic crypto/hash/signature
  serialization; never raw `JSON.stringify()` on those paths.

## Restricted Patterns

- Use `toLowerCase()` / `toUpperCase()`, never locale variants.
- Load `@onekeyfe/hd-core` through `await CoreSDKLoader()`; never import it directly.
- Use `localDb`, never import `localDbInstance` directly.
- Use yarn/oxfmt, not prettier; do not commit failing checks.

## Data And Dependencies

- Bump `LOCAL_DB_VERSION` (`packages/kit-bg/src/dbs/local/consts.ts`)
  for Realm schema changes (even optional fields), IndexedDB store/index
  changes, or version-gated migrations. Name the change; align schemas.
- Type-only edits and SimpleDB/serialized payload fields alone need no bump;
  assess compatibility separately.
- For third-party patches, follow `/1k-patch-package-workflow`; generated patches
  must exclude build artifacts.

## Debugging And Verification

- For RN launches, use `/1k-dev-commands` Mobile DevSession; use direct mobile
  scripts only for native rebuilds or diagnosis.
- If a command emits `ONEKEY_USER_NOTICE` (or receipt `userNoticeRequired: true`),
  report every notice even if fallback succeeds; never call it a clean cache hit.
- If a fix fails, re-analyze the root cause instead of retrying small variations.
- For visual bugs, establish platform and expected vs actual behavior first.
- For Electron/DApp/UI/startup/interaction fixes, state repro, non-passing
  conditions, and final pass condition first.
- Element existence is not proof: verify active state, real rendering,
  URL/title/content readiness, and console/log evidence.
- PR reviews (`/1k-address-pr-review`): triage before editing; never add UI/flows/copy
  for a comment (`Needs Decision`); if P0/P1s cluster or `yarn check:bloat` flags
  bloat, refactor boundaries instead of patching.

## Git And Validation

- Base branch is `x`; never work directly on `x`.
- Commit format: `type: short description`. Do not add tool attribution or
  `Co-Authored-By` lines.
- `tsc` runs the TypeScript 7 native compiler; no classic TypeScript JS API is
  installed. AST tooling uses `oxc-parser` / `@babel/parser` / `@swc/core`.
- Before commit run `yarn agent:check --profile commit`; before PR readiness run
  `yarn agent:check --profile pr`.
- For remote-only status run `yarn agent:check --profile ci --pr <number>`.
- Debug failed lint/type gates with lower-level commands; logs:
  `node_modules/.cache/agent-checks`.
- Run targeted tests when scope or risk requires them; avoid the root `yarn test`
  alias.

Use `.skillshare/skills` for detailed workflows; don't duplicate them here.
`apps/cli/` has separate guidance; external wallet CLI skills belong in
`https://github.com/OneKeyHQ/onekey-wallet-skills`.
