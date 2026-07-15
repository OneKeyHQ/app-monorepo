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

Identify the platform before runtime analysis:

- iOS/Android: `main` (UI) and `background` (bg) are isolated JS runtimes in one
  native process. JS objects are not shared; MMKV, DB/file handles, or native
  singletons may share an underlying native resource.
- Extension: UI, background/service worker, offscreen documents, and content
  scripts are isolated browser contexts. They communicate through bridges; do
  not apply native resource assumptions.
- Desktop/web: UI and `BackgroundApi` services share the app JS runtime. `bg` is
  a logical ownership boundary unless an Electron process, WebView, worker, or
  other execution context is involved.

For storage, state, memory, startup, or crash conclusions, state the platform;
`main`/UI, `bg`, or named-context owner; resource ownership; JS copy/clone
semantics; and initialization order. Separate runtimes/contexts initialize
independently. Label desktop/web conclusions as single-runtime and do not infer
duplicate JS state merely because code belongs to `kit-bg`.

Native main-JS and bg-JS bundles ship version-locked; practical native version
skew is native-vs-JS, not bg-vs-main.

## Import Hierarchy

Never violate this dependency order:

- `@onekeyhq/shared`: must not import other OneKey packages.
- `@onekeyhq/components`: may import `shared` only.
- `@onekeyhq/kit-bg`: may import `shared` and `core` only; never `components`
  or `kit`.
- `@onekeyhq/kit`: may import `shared`, `components`, and `kit-bg`.
- Application workspaces under `apps/` may import any OneKey workspace package.

## Security

- Never commit secrets, API keys, private keys, seeds, mnemonics, or sensitive
  user data.
- Never log sensitive data or bypass authentication, validation, CSP, transaction
  verification, or risk checks.
- Keep hardware-wallet orchestration in `kit-bg`. Native transport runs in the
  bg runtime; extension bg may delegate transport to offscreen; desktop/web bg is
  an in-runtime service boundary.
- Do not modify cryptographic functions without deep security review.
- Use `stringUtils.stableStringify()` for deterministic crypto/hash/signature
  serialization; never raw `JSON.stringify()` on those paths.

## Restricted Patterns

- Use `toLowerCase()` / `toUpperCase()`, never locale variants.
- Load `@onekeyfe/hd-core` through `await CoreSDKLoader()`; never import it directly.
- Use `localDb`, never import `localDbInstance` directly.
- Do not commit code that fails lint or TypeScript checks.

## Data And Dependencies

- Local DB schema changes must keep Realm and IndexedDB definitions in sync and
  bump `LOCAL_DB_VERSION` in `packages/kit-bg/src/dbs/local/consts.ts`.
- Schema changes include Realm properties/getters, IndexedDB stores/schema maps,
  and persisted model fields.
- For third-party patches, follow `/1k-patch-package-workflow`; generated patches
  must exclude build artifacts.

## Debugging And Verification

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
