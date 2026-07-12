# @onekeyhq/playground

A **web-only Storybook component workbench** for `@onekeyhq/components`. It boots
in seconds under the real app constraints (Tamagui theme, i18n, `@onekeyhq/shared`)
without booting the full app — no `@onekeyhq/kit`, no `backgroundApiProxy`, no
navigation, no jotai.

## Run it

```bash
yarn app:playground        # → http://localhost:6006
```

(equivalently `yarn workspace @onekeyhq/playground sb:dev`.)

Build a static site:

```bash
yarn workspace @onekeyhq/playground sb:build   # → apps/playground/dist
```

## What this is (and isn't)

- **Is:** a fast Vite + Storybook shell that renders individual components with
  live Controls, a theme/locale toolbar, autodocs, and viewport presets.
- **Isn't:** the app. There is no wallet state, no background services, no
  navigation. Stories that need those belong in the kit Gallery, not here.

## How to add a story

1. **Colocate** the story next to the component:
   `packages/components/src/**/MyComponent.stories.tsx`.
2. **Import via direct path**, never the barrel:
   `import { Button } from '@onekeyhq/components/src/primitives/Button'`.
   The barrel (`@onekeyhq/components`) drags layouts / Navigation / the whole
   library into the graph and will break the fast build.
3. Use CSF: a default `meta` (`satisfies Meta<typeof X>`) plus named
   `StoryObj` exports. `fn()` for action args comes from `storybook/test`.
4. Story/renderer types come from `@storybook/react-native-web-vite`.

The `stories` glob in `.storybook/main.ts` already picks up every
`packages/components/src/**/*.stories.@(ts|tsx)` — no registration step.

## The decorator contract

`.storybook/preview.tsx` wraps every story in `ConfigProvider`
(`packages/components/src/hocs/Provider`), which supplies:

- **Tamagui** theme + config (`theme` global: light / dark)
- **i18n** (`AppIntlProvider`; `locale` global: en-US / zh-CN / zh-TW) — this is
  what lets components that call `useIntl()` (e.g. `Input` via `useClipboard`)
  render.
- SafeArea + Portal + fonts.

`ConfigProvider` also requires a `HyperlinkText` component prop (normally from
`@onekeyhq/kit`). We pass a local stub (`.storybook/HyperlinkTextStub.tsx`) so
kit stays out of the graph. The stub must render
`children ?? defaultMessage ?? translationId` — Toast's `RenderLines` (and
other intl-formatting callers) pass `translationId`/`defaultMessage` with NO
children, so a children-only stub silently renders empty toasts.

The decorator also mounts — **inside** `ConfigProvider`, in the app's order —
the minimal slice of the app's `FullWindowOverlayContainer`:

- `<Portal.Container name={FULL_WINDOW_OVERLAY_PORTAL}>` — mount point for
  `Dialog.show`, `ActionList`, Popover/Select sheets; being inside
  `ConfigProvider` is what keeps portaled content themed/intl'd.
- `<ShowToastProvider />` — `Toast.show` custom toasts.
- `<Toaster />` — `Toast.success/error/…` (sonner on web, backpackapp on
  native; sonner renders no DOM until the first toast, so an "empty" toaster
  is normal).

The native shell's `.rnstorybook/preview.tsx` mounts the same three, wrapped
in `OverlayContainer` (iOS `FullWindowOverlay`); the backpackapp `Toaster`
additionally needs the `GestureHandlerRootView` that `.rnstorybook/index.tsx`
mounts at the shell root (the wallet gets one from kit's provider tree).

The decorator remounts on theme/locale change (via `key`) to avoid stale Tamagui
theme state.

## How the fast build works

Storybook runs on Vite (`@storybook/react-native-web-vite`). `.storybook/main.ts`
ports the web resolution rules from `development/rspack/rspack.base.config.ts`:

- `react-native` → `react-native-web`, plus the `react-native/Libraries/*` and
  native-only-module aliases.
- Node polyfills (`crypto` → cross-crypto, `stream` → stream-browserify,
  `buffer`; other builtins → empty stub) and `Buffer` / `process` globals
  (`.storybook/polyfills.ts`).
- `define` for the load-bearing `process.env.ONEKEY_PLATFORM='web'` and friends.
- `resolve.mainFields = ['browser','module','main']` and `react-native` removed
  from `resolve.conditions` — **hard-overridden after `mergeConfig`** because the
  RNW-vite framework re-adds them, which would make `moti` / `react-native-svg`
  resolve untranspiled RN source and crash.
- `resolve.extensions` = the rspack web order **minus `.wasm` / `.d.ts`** (those
  must not be runtime-resolvable under Vite).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `require is not defined` | A runtime `require()` in `packages/{components,shared}`. Widen the `viteCommonjs({ include })` glob in `main.ts`. |
| `moti` / `react-native-svg` resolve errors | The `conditions` / `mainFields` override didn't take. `console.log(merged.resolve)` in `viteFinal`. |
| `global is not defined` | Already defined via `define.global = 'globalThis'`; check it wasn't dropped. |
| "new dependency discovered, reloading" flicker | Add the package to `optimizeDeps.include` in `main.ts`. |
| An icon doesn't render | Icon keys live in `packages/components/src/primitives/Icon/Icons.tsx` (e.g. `PlusCircleOutline`, `ArrowRightOutline`, `SearchOutline`). |

## Spike decision record

**Winner: Plan A — `@storybook/react-native-web-vite` (Storybook 10.5.0, Vite 6;
spiked on 9.1.20, upgraded via `npx storybook@latest upgrade` the same day).**
The upgrade's automigrations added `@storybook/addon-mcp` (agent tooling),
`eslint-plugin-storybook` (root `.eslintrc.js` extends), wrapped
framework/addons in `getAbsolutePath()` (monorepo resolution), and converted
`main.ts` to real ESM (`import.meta.url`-derived `CONFIG_DIR` — SB10 no longer
provides `__dirname`).
All 7 acceptance criteria passed with Button, Input and Badge rendering under the
real ConfigProvider (Tamagui theme + i18n): correct Roobert font and token
colors, live Controls (args), light/dark theme toggle, working i18n chain (Input
→ `useClipboard` → `useIntl`), and `<2s` HMR with no full reload. Plan B
(`@storybook/react-vite` + hand-rolled Vite) was **not needed**.

Four fixes beyond the original plan were required to get Plan A green — all live
in `.storybook/main.ts` / `injectTamaguiCss.ts`:

1. **`react-native/Libraries/*` stub plugin.** The framework's own broad
   `react-native → react-native-web` string alias rewrites deep
   `react-native/Libraries/*` ids into non-existent
   `react-native-web/Libraries/...` files (RNW ships no `Libraries/` dir) and
   crashes the esbuild dep-optimize scan — first hit was the bundled on-device
   network devtools (`@rozenite/network-activity-plugin`) importing
   `WebSocketInterceptor`. Fixed with an `enforce: 'pre'` `resolveId` plugin
   (order-independent) that stubs the whole class except the handful of ids
   with a real RNW counterpart (`RNW_LIBRARIES_REMAPS`), plus
   `optimizeDeps.exclude` for the devtools package.

2. **Manual `config.getCSS()` injection (`.storybook/injectTamaguiCss.ts`, the
   first import in preview.tsx).** `tamagui.config` is
   created with `disableSSR: true` + `themeClassNameOnRoot: false`, so Tamagui
   expects a compiler/SSR step to emit the theme-variable blocks
   (`.t_light { --bgApp: … }`, tokens, fonts). A pure-runtime Storybook has no
   such step, so atomic classes landed but every `var(--…)` resolved to
   transparent/0/Arial. Injecting the full CSS once (the documented "no compiler"
   path) makes themes/tokens/fonts resolve.

3. **`@onekeyfe/react-native-text-input` excluded from optimizeDeps.** It's a raw
   TS-source package (`export enum …`); esbuild pre-bundling mangled its named
   export into a default-only interop and broke Input. Excluding it lets Vite
   transform the TS source directly.

4. **`@babel/plugin-syntax-decorators` (legacy, syntax-only) for `sb:build`.**
   The production build's babel pass parses raw workspace TS and died on the
   logger-scope method decorators in `@onekeyhq/shared`. Syntax-only is
   deliberate: esbuild compiles the decorators later via tsconfig
   `experimentalDecorators` (same as dev). The full
   `@babel/plugin-proposal-decorators` transform emits an `abstract class`
   expression that crashes the downstream react-docgen plugin, and adding
   `plugin-transform-class-properties` (as the rspack chain does) breaks on
   `declare` fields in node_modules RN packages (e.g. `expo-image`) that this
   babel pass also covers.

The one remaining console warning — React's "does not recognize the `borderCurve`
prop" — is Tamagui's `borderCurve="continuous"` style prop leaking to the DOM.
It's cosmetic (present in the app itself) and RNW-deprecation-class, so it's
tolerated per acceptance criterion 7.

## On-device (iOS) spike record

**Verdict: green — the same CSF files run on-device via `@storybook/react-native`
(10.4.7; peers on storybook core `>=10`, so it coexists with the web shell's
10.5) with zero story changes.** Parked until story coverage justifies a
build-out; all wiring lives in `apps/mobile` (`.rnstorybook/`, the
`withStorybook` wrap in `metro.config.js`, and a root-component swap in
`index.ts`).

Run it:

```bash
yarn workspace @onekeyhq/mobile storybook   # Metro in storybook mode on :8081
# then launch the iOS dev app (an existing simulator Debug build works — the
# spike needed no pod install / native rebuild)
```

Verified 2026-07-11 on an iPhone 16 Pro simulator:

- Button/Input/Badge render with correct Tamagui tokens, pill radii and Roobert
  under the same `ConfigProvider` decorator (no CSS injection needed on native;
  the theme/locale are fixed to light/en-US until a build-out adds switching).
- Args updates re-render live (ondevice-controls), and the Input → `useClipboard`
  → `useIntl` chain works.
- `STORYBOOK_ENABLED=true` swaps only the registered root in
  `apps/mobile/index.ts`; bg/native bootstrap stays identical. Without the env,
  `withStorybook({ enabled: false })` strips every storybook module from the
  bundle via its resolver (23387 → 22713 modules) — normal dev and production
  builds are unaffected, verified by a full normal boot.
- `.rnstorybook/storybook.requires.ts` is regenerated on each storybook-mode
  Metro start but is content-stable (require.context globs; websocket host
  pinned to `localhost`), so it is committed for tsc and excluded from
  oxlint / `lint:staged` as a generated file.
- The channel WebSocket on `:7007` accepts storybook channel events
  (`setCurrentStory`, `updateStoryArgs`) — scripted/agent-driven verification
  without touching the simulator.
- `@react-native-community/datetimepicker` is present JS-only (an
  ondevice-controls peer); run `pod install` before using date controls in
  stories.
- First cross-platform diff the native shell caught: `Badge` stretches
  full-width on native (RN's default `alignSelf: stretch`) while hugging its
  content on web — exactly the class of difference this shell exists to show.
- **Mode switching is cache-safe**: the `STORYBOOK_ENABLED` babel inlining is
  invisible to Metro's transform-cache key, so flipping modes used to serve the
  stale entry (wallet inside storybook mode) until `metro.config.js` started
  namespacing `config.cacheVersion` per mode. Symptom if it regresses: Metro
  runs with the channel server on `:7007` but the app boots the wallet — no
  `--clear` needed, just check that cacheVersion line.
- **The shell mirrors two wallet boot duties** (`.rnstorybook/index.tsx`),
  discovered when the story graph grew beyond the original three components:
  `content/Splash` (pulled in via the content barrel from e.g. Checkbox) calls
  expo-splash-screen's `preventAutoHideAsync` at module scope, so the shell
  must `hideAsync()` after mount or the UI stays behind the launch screen; and
  the native AppDelegate watchdog counts every launch as failed until
  `BootRecovery.markBootSuccess()` — without the shell's 5s-delayed call, a
  few storybook relaunches trip the "We hit a snag" recovery screen (clear it
  by reinstalling the app; `simctl spawn defaults write` does NOT work — the
  counter lives in the app container's own preferences plist).
- Second cross-platform catch: `ListView` (FlashList) collapses to zero height
  on native inside an unbounded container (its wrapper is `flex: 1`) while web
  auto-sizes — bound the parent (`<Stack h={...}>`) in stories that render
  lists.
- `Checkbox.Group` has zero production call sites and hits the ListView
  collapse above through its own unbounded `YStack`, so it deliberately has no
  story — deletion candidate. Its Gallery demo section (its last usage) was
  removed in batch 3.
- Platform-behavior diff surfaced by Switch stories: iOS renders the on-state
  track in brand green (`$bgAccent`, per the component's intent) while web
  uses monochrome `$bgPrimary`.
- Story-layout trap from batch 3 (Toast/Popover/ActionList/Radio/Alert/
  IconButton): in the preview's full-width column, `ActionList`'s internal
  Trigger wrapper stretches to the row, so the gtMd floating panel anchors to
  the full-width box and pins to the right edge. App layouts always put
  triggers in content-sized containers; the story meta adds an `<XStack>`
  decorator to restore that. Popover does not stretch (its trigger wrapper
  hugs) — only ActionList needs it.
- Rebase hygiene: `patches/*` changes ride in without `yarn.lock` changing, so
  a rebase can leave `node_modules` unpatched (symptom: tsc errors in files
  you never touched, e.g. a missing prop that the patch adds). `git apply
  patches/<pkg>.patch` for a brand-new patch, or reverse-apply the old version
  first (`git show <old-sha>:patches/… | git apply -R -`) for a modified one.
