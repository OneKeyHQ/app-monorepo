---
name: 1k-startup-profile
description: "Deep startup profiling for OneKey mobile — per-module JS factory timings, HBC I/O/parse breakdown, per-segment timings. Gated behind the single env var `ONEKEY_STARTUP_PROFILE=1`. Zero overhead when disabled (default). Use when diagnosing cold-start regressions, sizing main.bundle parse cost, finding slow modules, measuring segment load, or auditing what a 1.7s `require('./App')` actually contains. Triggers on: startup profile, 启动性能分析, module timing, HBC parse time, segment timing, require cost, StartupProfile, ONEKEY_STARTUP_PROFILE, __d patcher, inline-requires."
disable-model-invocation: true
---

# Startup Profile — deep per-module + HBC + segment timing

Single env-var flag `ONEKEY_STARTUP_PROFILE=1` turns on **three layers** of
measurement at once. **When OFF (the default), every measurement path is a
single boolean check — zero observable overhead in production.**

---

## What gets measured

| Layer | Log tag | Content | Source |
|---|---|---|---|
| **1. JS modules** | `[StartupProfile.js]` | Top 200 modules by *self-time* (total minus time spent in nested requires) + `moduleId → path` | `apps/mobile/src/startupProfile/index.ts` |
| **2. HBC files** | `[StartupProfile.hbc]` | Main bundle I/O ms + size in bytes; parse+eval is derivable from existing `ios.main_entry.evaluated` / RN timing | iOS `AppDelegate.swift`, Android `MainApplication.java` |
| **3. Segments** | `[StartupProfile.seg]` | Per-`.seg.hbc` total duration + id + key + relative path | `apps/mobile/src/splitBundle/installProdBundleLoader.ts` |

---

## How to enable

### Method 1 — build-time env var (production-capable)

Export before any of the build commands:

```bash
export ONEKEY_STARTUP_PROFILE=1

# JS bundle: Metro plugin picks it up and prepends
#   globalThis.__ONEKEY_STARTUP_PROFILE__ = true
#   globalThis.__ONEKEY_MODULE_ID_TO_PATH__ = {...}
# to the main entry bundle.
yarn app:android           # or `yarn app:ios` / EAS build command

# iOS native: read from Info.plist key or Xcode scheme env
# Android native: read from BuildConfig.ONEKEY_STARTUP_PROFILE (auto-set by
# build.gradle from the same env var)
```

For EAS builds, set the env var in `eas.json` for the build profile you want to profile:
```jsonc
{
  "build": {
    "profile-startup": {
      "extends": "base",
      "env": {
        "ONEKEY_STARTUP_PROFILE": "1"
      }
    }
  }
}
```
Then `eas build --profile profile-startup --platform android`.

### Method 2 — Xcode scheme env (iOS dev only)

Xcode → Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables:
```
ONEKEY_STARTUP_PROFILE = 1
```
This is picked up by `ProcessInfo.processInfo.environment` at runtime — works only for debug iOS running from Xcode.

### Method 3 — Release iOS via Info.plist

In `Info.plist` add (or let an xcconfig generate at build time):
```xml
<key>ONEKEY_STARTUP_PROFILE</key>
<true/>
```
Or an xcconfig that reads the env var:
```
ONEKEY_STARTUP_PROFILE = YES
```
Ship a profile-enabled TestFlight build to inspect real-device release timings.

---

## What shows up in the log when enabled

Cold-start sequence (Android, ~2.5s to TTI):

```
[StartupTiming] android.app.on_create.start: +0ms from launch (anchor)
...existing native instrumentation...
[StartupProfile.hbc] android.index.android.bundle: io=35ms size=18900000B (prewarm, at +180ms from launch)
[StartupTiming] main_host.did_start: +318ms from launch (android)
...
[StartupTiming] MMKV contextAtom snapshot pre-read: 10 keys (+121ms)
[StartupProfile.seg] 22ms id=3288 key=seg:nm.@formatjs path=segments/nm._formatjs.seg.hbc
[StartupProfile.seg] 12ms id=3311 key=seg:shared.locale.json.zh_CN.json path=...
[StartupProfile.seg] 230ms id=3021 key=seg:kit.provider.Container.KeylessWalletContainer.KeylessWalletContainer path=...
...
[StartupTiming] main entry evaluated (+1780ms)
[StartupProfile.js] summary: tracked=187 modules timed (>=1ms), sum_self=1524ms, sum_inclusive=3847ms, flushing top 200 by self-time
[StartupProfile.js] self=142ms total=189ms packages/kit/src/provider/Container/PrimeLoginContainer/PrimeLoginContainer.tsx
[StartupProfile.js] self=87ms total=312ms packages/kit/src/states/jotai/contexts/tokenList/atoms.ts
[StartupProfile.js] self=64ms total=64ms node_modules/@walletconnect/core/dist/...
...etc up to 200 modules
```

---

## Interpreting the numbers

### `[StartupProfile.js]` — module-level

- **`self`** = time inside this module's own factory body *excluding* any nested `require()` calls. **This is the actionable signal** — a module with `self=100ms` actually costs 100ms of its own code.
- **`total`** = inclusive time — includes time spent in everything this module requires. Useful for identifying "roots" of slow subtrees (e.g. `./App` might have `self=5ms total=1600ms`).
- **Only modules ≥ 1ms** are recorded; sub-ms is filtered to avoid swamping the log with thousands of near-zero entries.
- The measurement patches Metro's `__r` (require), NOT `__d` (define). Reason: by the time our JS code runs, `__d` has already registered all factories with the unwrapped version — too late to wrap. `__r` is what runs the factory lazily, so wrapping it captures every first-time module load regardless of patch timing.

### `[StartupProfile.hbc]` — main bundle file I/O

- **`io`** is pure OS-level read time (open → EOF).
- We can't directly measure Hermes bytecode parse time from the outside; instead compute `parse+exec = <native ios.main_entry.evaluated> - io`.
- **Pre-warm side effect**: after this probe the bundle is in the OS page cache. RN's subsequent load no longer pays I/O. If you want to measure non-warm-cache I/O, disable the probe for that run.
- **Android probe is fire-and-forget** on a MIN_PRIORITY thread to not stall `Application.onCreate`.

### `[StartupProfile.seg]` — segment load

- Single aggregate per segment: combined I/O + Hermes parse + register. Splitting these would need a patch to `@onekeyfe/react-native-split-bundle-loader`; for now the aggregate is enough to identify the slowest segments.
- The relative-path suffix tells you which file in the segment dir is the culprit.

---

## Cross-platform check: are both sides reading the same flag?

Grep the startup log after enabling:

```bash
grep 'StartupProfile' app-latest.log | head -5
```

Expected: at least one `[StartupProfile.js]`, `[StartupProfile.hbc]`, `[StartupProfile.seg]` line. If only some show up:

| Missing | Likely cause | Fix |
|---|---|---|
| `[StartupProfile.js]` | Metro prologue not injected → `globalThis.__ONEKEY_STARTUP_PROFILE__` is undefined | Confirm `ONEKEY_STARTUP_PROFILE=1` was set in the env when Metro built the bundle. Check `apps/mobile/plugins/index.js` `buildStartupProfilePrologue()` |
| `[StartupProfile.hbc]` | Native flag not read: Android `BuildConfig.ONEKEY_STARTUP_PROFILE` is false, or iOS Info.plist key missing | Android: ensure env var was set at `./gradlew assembleRelease` time (not just at Metro time). iOS: check Info.plist or xcconfig |
| `[StartupProfile.seg]` | The JS-side flag was never set (same as first row) — segment logs reuse the JS flag | Same fix as first row |

---

## Zero-overhead guarantee when disabled

Each layer's code path when `ONEKEY_STARTUP_PROFILE` is not set:

- **JS**: `isStartupProfileEnabled()` reads `globalThis.__ONEKEY_STARTUP_PROFILE__` (`undefined` → `false`), function returns, no patching, no allocation.
- **iOS native**: `isStartupProfileEnabled()` checks ProcessInfo env and Info.plist, returns false, skips the `Data(contentsOf:)` probe.
- **Android native**: `if (BuildConfig.ONEKEY_STARTUP_PROFILE)` — dead-code eliminated at compile time when false.
- **Segment logs**: `if ((globalThis as any).__ONEKEY_STARTUP_PROFILE__ === true)` — one identity check per segment load, sub-µs.

**Production release bundle overhead when flag is off: ≈ 0.** No removal needed, instrumentation can live in the main branch permanently.

---

## Files touched

| File | Purpose |
|---|---|
| `apps/mobile/src/startupProfile/index.ts` | JS `__r` patcher + flush |
| `apps/mobile/index.ts` | Two-line hook to install & flush |
| `apps/mobile/plugins/index.js` | Metro prologue injection (`__ONEKEY_STARTUP_PROFILE__` + moduleId→path map) |
| `apps/mobile/src/splitBundle/installProdBundleLoader.ts` | Per-segment log |
| `apps/mobile/ios/AppDelegate.swift` | iOS HBC I/O probe + flag reader |
| `apps/mobile/android/app/build.gradle` | Expose env var → `BuildConfig.ONEKEY_STARTUP_PROFILE` |
| `apps/mobile/android/app/src/main/java/.../MainApplication.java` | Android HBC I/O probe |

---

## Parsing script (quick aggregation)

```bash
LOG=path/to/app-latest.log

# JS modules sorted by self-time (what you really want to know)
grep '\[StartupProfile\.js\] self=' "$LOG" | head -30

# Total JS cost of top 20 modules
grep '\[StartupProfile\.js\] self=' "$LOG" \
  | head -20 | awk '{sum+=$3} END {print sum}' \
  | sed 's/self=//'

# Segment slowest 10
grep '\[StartupProfile\.seg\]' "$LOG" | sort -k2 -n -r | head -10

# HBC I/O vs (ios.main_entry.evaluated - io)
grep 'StartupProfile\.hbc\|ios.main_entry.evaluated\|android.index.android.bundle' "$LOG"
```

---

## Caveats

1. **Metro `inline-requires` transform** moves top-level `const X = require(...)` to the first use-site. This is why we patch `__r` rather than `__d`. But module IDs are the same — patching is safe.
2. **Inclusive time `sum_inclusive` will be much larger than `sum_self`** because every nested require is counted in each parent. Don't add them naively to reason about total time.
3. **Segment split (I/O vs parse)** requires patching `@onekeyfe/react-native-split-bundle-loader`. Not done yet. The combined number is usually enough for triage.
4. **Dev / debug builds** include source maps + extra instrumentation — numbers will be 2-3× higher than Release. Profile Release builds for real baselines.
5. **Flag is build-time, not runtime**: to toggle, rebuild. This is deliberate — zero overhead when off, and avoids the complexity of a Dev Settings toggle + MMKV sync across JS/native at startup.
