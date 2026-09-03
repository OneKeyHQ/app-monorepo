# Agent Instructions

OneKey is a TypeScript React/React Native monorepo for desktop, mobile, web,
and browser extension wallet apps. Keep changes scoped, typed, cross-platform
aware, and aligned with existing package boundaries.

## Core Rules

- Do not remove existing code/components unless the request requires it.
- Keep TypeScript precise: no fallback `never[]`, avoidable `any`, or
  unjustified `@ts-ignore`.
- Use platform-specific files or `Platform.select` for platform behavior; do
  not apply global style fixes to platform-specific bugs.
- Write comments in English and only for non-obvious logic.
- Never modify generated translations (`translations.ts`, locale JSON files).

## Runtime Topology

Production runtime topology differs by target:

- iOS, Android, and browser extension run `main` (UI) and `background` (`bg`)
  as isolated JS runtimes. Their JS heaps and objects are not shared. Native
  resources such as MMKV, DB/file handles, and native singletons may still be
  shared underneath.
- Desktop and web execute app `main`/`background` code in one JS runtime/thread.
  Do not apply split-heap or per-runtime deserialization assumptions to them.

For native, storage, state, memory, startup, or crash analysis, state the target
platform first. On iOS/Android/extension, also state:

- Runtime scope: `main`, `bg`, or both.
- Native resource ownership: shared native instance or per-runtime instance.
- JS heap copies: whether data is deserialized once per runtime.
- Timing/order: `main` and `bg` initialize independently; do not assume readiness.

For desktop/web, label the conclusion as single-runtime and identify any native
or process-owned resource separately. `main` and `bg` JS bundles on split-runtime
targets ship version-locked; practical skew is native-vs-JS, not `bg`-vs-`main`.

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

- Local DB schema changes must keep Realm and IndexedDB definitions in sync and
  bump `LOCAL_DB_VERSION` in `packages/kit-bg/src/dbs/local/consts.ts`.
- Schema changes include Realm properties/getters, IndexedDB stores/schema maps,
  and persisted model fields.
- For third-party patches, follow `/1k-patch-package-workflow`; generated patches
  must exclude build artifacts.

## Debugging And Verification

- For normal React Native launches, use `/1k-dev-commands` Mobile DevSession;
  use direct mobile workspace scripts only for native rebuilds or diagnosis.
- If a command emits `ONEKEY_USER_NOTICE`, or its run receipt has
  `userNoticeRequired: true`, report every notice explicitly to the user even
  when the fallback succeeds. Never describe that run as a clean cache hit.
- If a fix fails, re-analyze the root cause instead of retrying small variations.
- For visual bugs, establish platform and expected vs actual behavior first.
- For Electron, DApp, UI, startup, and interaction fixes, state the repro,
  non-passing conditions, and final pass condition before editing.
- Element existence is not proof. Verify active state, real webview rendering,
  URL/title/content readiness, and relevant console/log evidence.

## Git And Validation

- Base branch is `x`; never work directly on `x`.
- Commit format: `type: short description`. Do not add tool attribution or
  `Co-Authored-By` lines.
- Before commit run `yarn agent:check --profile commit`; before PR readiness run
  `yarn agent:check --profile pr`.
- For remote-only status run `yarn agent:check --profile ci --pr <number>`.
- Use lower-level commands only to debug a failed `agent:check`; logs are under
  `node_modules/.cache/agent-checks`.
- Run targeted tests when scope or risk requires them; avoid the ambiguous root
  `yarn test` alias.

Use `.skillshare/skills` for detailed workflows instead of duplicating them here.
`apps/cli/` has separate guidance; external wallet CLI skills belong in
`https://github.com/OneKeyHQ/onekey-wallet-skills`.
