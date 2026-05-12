---
name: 1k-cold-start-ssr
description: "Jotai Cold Start SSR + unified startup timing schema — cold start optimization via MMKV snapshot hydration and the cross-platform `[StartupTiming]` log taxonomy for OneKey native app. Use when debugging startup performance regressions, analyzing cold start timeline, comparing iOS vs Android startup phases, or modifying the snapshot hydration pipeline. Triggers on: cold start, startup optimization, 启动时间, SSR hydration, Balance displayed regression, MMKV snapshot, contextAtomBase, flushColdStartCache, __ONEKEY_CTX_ATOM_SNAPSHOT__, StartupTiming, main_host.did_start, bg_runner.start, ios.main_entry.evaluated, android.app.on_create, android.activity.on_create."
disable-model-invocation: true
---

# Jotai Cold Start SSR

Cold start optimization pattern for OneKey native app. Analogous to web SSR hydration — previous session's atom values are persisted to MMKV, pre-read at startup, and used as initial atom values so the first React render displays cached data immediately without waiting for network.

**Currently supported:** Native (iOS/Android) only. Desktop/Web/Extension support planned.

## Architecture Overview

```
Session N (runtime)                    Session N+1 (cold start)
─────────────────────                  ──────────────────────────
                                       
Phase 3: SAVE                          Phase 1: PRE-READ
atom value changes                     index.ts (entry point)
  → coldStartValuesMap                   → MMKV.getString(snapshot)
  → debounce 2s                          → globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__
  → flushColdStartCache()               
  → MMKV.set(snapshot JSON)             Phase 2: HYDRATION
                                       contextAtomBase (module load)
Also flushes on AppState               → read __ONEKEY_CTX_ATOM_SNAPSHOT__
  'background' event                     → use as atom initialValue
                                         → first render shows cached data
                                       
                                       Phase 4: REVALIDATION
                                       BG thread fetches fresh data
                                         → atoms update in-place
                                         → UI re-renders with live data
```

## The Three Phases (Code Locations)

### Phase 1: Snapshot Pre-read

**File:** `apps/mobile/index.ts` (top of entry point, before any module imports)

```typescript
// Reads cold start cache from dedicated MMKV instance into globalThis
// MUST execute before any contextAtomBase module evaluates
const _ctxRaw = coldStartCacheStorage.getString(
  EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
);
if (_ctxRaw) {
  (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ = JSON.parse(_ctxRaw);
}
```

**Key constraints:**
- Must be synchronous (MMKV is sync)
- Must run before any `require()` that triggers `contextAtomBase`
- Stored in dedicated `coldStartCacheStorage` MMKV instance (separate from app settings)

### Phase 2: Hydration

**File:** `packages/kit-bg/src/states/jotai/utils/index.ts` — `contextAtomBase()`

```typescript
// At module-load time, read cached value from pre-loaded snapshot
let resolvedInitialValue = initialValue;
if (snapshotKey) {
  const ctxSnapshot = (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__;
  if (ctxSnapshot && snapshotKey in ctxSnapshot) {
    const cached = ctxSnapshot[snapshotKey];
    resolvedInitialValue = { ...initialValue, ...cached };
  }
}
const atomBuilder = memoizee(() => atom(resolvedInitialValue));
```

**Key constraints:**
- Runs at module evaluation time (not in React lifecycle)
- `memoizee` ensures atom is created once with the cached value
- Only applies to context atoms with a `name` — globalAtoms use MMKV per-key directly

**Also:** `hydrateContextColdStartCacheForProvider()` — called at provider mount time for scoped hydration (per-account data).

### Phase 3: Save (for next cold start)

**File:** `packages/kit-bg/src/states/jotai/utils/index.ts` — `flushColdStartCache()`

```typescript
// Read-modify-write: patch only dirty keys into existing snapshot
// Preserves cached values for scopes not rendered this session
const snapshot = raw ? JSON.parse(raw) : {};
for (const name of coldStartDirtyKeys) {
  snapshot[name] = coldStartValuesMap.get(name);
}
coldStartCacheStorage.set(key, JSON.stringify(snapshot));
```

**Trigger points:**
- `scheduleColdStartSave()` — debounced 2s timer after any atom value change
- `AppState 'background'` event — flush immediately when app goes to background

**Key constraints:**
- Uses read-modify-write (not full overwrite) to preserve unrendered scopes
- All callers are on main thread — no cross-thread race
- `coldStartValuesMap` tracks all rendered atom values via `wrappedUse()`

### Snapshot Cleanup

`__ONEKEY_CTX_ATOM_SNAPSHOT__` is cleaned up on `HomePageReady` event (first screen rendered), not on `setTimeout(0)`. This ensures split-bundle lazy-loaded modules can still hydrate from the snapshot.

## Split Bundle: main vs background Bundle Sizes

The app uses a dual-runtime split bundle architecture. Bundle sizes directly impact cold start:

```
common.jsbundle    ~8.8MB    Shared polyfills, loaded by native at app launch
main.jsbundle     ~10.1MB    UI thread entry, async-evaluated after ~100ms defer
background.bundle ~20.7MB    BG thread, loaded in parallel Hermes runtime
+ segment files   variable   Lazy-loaded on demand (vault impls, icons, etc.)
```

**Impact on cold start timeline:**
- `common.jsbundle` (8.8MB): blocks native → JS handoff (~100ms)
- `main.jsbundle` (10.1MB): async eval takes ~1300ms — **the single biggest bottleneck** (87% of total startup)
- `background.bundle` (20.7MB): runs in parallel, apiProxy import ~700ms. Currently non-blocking but close to critical path (BG ready at +1261ms vs main eval at +1300ms)
- Segment loads: icon segments ~25ms each, vault settings ~20ms each, loaded on-demand after first render

**Rules of thumb:**
- Any code added to `main.jsbundle` directly increases the 1300ms eval time
- Move non-critical code to segments (lazy `import()`) to keep main bundle lean
- `background.bundle` size is less critical since it runs in parallel, but if it gets slower than main eval it becomes a blocker
- Use `apps/mobile/scripts/unionBuild.js` to analyze bundle composition

## contextAtom Cold Start Cache Keys (SSR Keys)

Each context atom that participates in Cold Start SSR must declare a `coldStartCacheKey`. These keys are registered in a central const:

**File:** `packages/shared/src/consts/jotaiConsts.ts`

```typescript
export const CONTEXT_ATOM_COLD_START_CACHE_KEYS = {
  accountWorthAtom: 'ctx:accountWorthAtom',
  lastConfirmedOverviewBalanceAtom: 'ctx:lastConfirmedOverviewBalanceAtom',
  walletTopBannersAtom: 'ctx:walletTopBannersAtom',
  selectedAccountsAtom: 'ctx:selectedAccountsAtom',
  accountSelectorStorageReadyAtom: 'ctx:accountSelectorStorageReadyAtom',
  activeAccountsAtom: 'ctx:activeAccountsAtom',
  renderedTokenListCacheAtom: 'ctx:renderedTokenListCacheAtom',
} as const;
```

**Usage in atom definition:**

```typescript
// packages/kit/src/states/jotai/contexts/tokenList/atoms.ts
const { atom: renderedTokenListCacheAtom } = contextAtom<ITokenListValue>(
  defaultValue,
  {
    coldStartCache: true,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.renderedTokenListCacheAtom,
  },
);
```

**Scoped key format in MMKV snapshot:**

Context atoms are scoped by provider (e.g., different accounts). The snapshot stores scoped keys:

```
{scopeKey}::{coldStartCacheKey}
```

Example: `hd-1--0::ctx:renderedTokenListCacheAtom`

- `scopeKey` comes from `store.__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__` (set when creating the Jotai store for a provider)
- `coldStartCacheKey` is the `ctx:xxx` string from the const above

**Adding a new SSR-cached atom:**

1. Add key to `CONTEXT_ATOM_COLD_START_CACHE_KEYS` in `jotaiConsts.ts`
2. Pass `{ coldStartCache: true, coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.yourKey }` to `contextAtom()`
3. The atom will automatically be tracked by `wrappedUse()` and saved by `flushColdStartCache()`
4. On next cold start, the cached value will be used as `initialValue` via Phase 2 hydration

**Caution:** Only cache atoms whose data is safe to show stale (e.g., token list, balance). Don't cache atoms with security-sensitive or time-critical data.

## SWR Cache (usePromiseResult)

Separate from Jotai Cold Start SSR but shares the same `coldStartCacheStorage` MMKV instance.

**File:** `packages/shared/src/utils/swrCacheUtils.ts`

**Purpose:** Cache results of `usePromiseResult` hooks so repeated renders / screen revisits don't re-fetch from network.

```typescript
// In usePromiseResult:
const swrCacheEntry = swrCacheUtils.getWithTimestamp<T>(swrKey);
const effectiveInitResult =
  swrCacheEntry !== undefined ? swrCacheEntry.data : options.initResult;
```

**Key characteristics:**
- Stored in `coldStartCacheStorage` under key `onekey_swr_cache` (single JSON blob)
- Max 80 entries with LRU eviction (oldest timestamp dropped first)
- Debounced 2s flush + immediate flush on `AppState 'background'`
- Key builders centralized in `swrKeys` (e.g., `swrKeys.allNetworksCompatible(...)`, `swrKeys.defiEnabled(networkId)`)
- Survives app restart (same MMKV instance as cold start cache)

**Relationship to Cold Start SSR:**
- SWR cache handles **hook-level** data (network responses, computed results)
- Cold Start SSR handles **atom-level** data (Jotai state)
- Both persist to the same MMKV instance (`coldStartCacheStorage`) but under different keys
- Both flush on `AppState 'background'`

## Key Differences: contextAtom vs globalAtom

| | contextAtom (scoped) | globalAtom (singleton) |
|---|---|---|
| Examples | tokenListAtom, accountWorthAtom | settingsPersistAtom |
| Cold start source | `__ONEKEY_CTX_ATOM_SNAPSHOT__` (Phase 1-2) | MMKV per-key direct read |
| Storage | `coldStartCacheStorage` blob | `jotaiMMKV` per-key |
| Write mechanism | `flushColdStartCache` debounced | `atomWithStorage` immediate |
| Scope | Per-provider (account-specific) | Global singleton |

## Diagnosing Cold Start Regressions

### Step 1: Collect NativeLogger Timeline

NativeLogger writes to `app-latest.log`:
- **iOS (simulator):** `~/Library/Developer/CoreSimulator/Devices/*/Containers/Data/Application/*/Library/Caches/logs/app-latest.log`
- **iOS (device):** Xcode → Window → Devices and Simulators → select device → OneKey → "Download Container" → inspect `AppData.xcappdata/AppData/Library/Caches/logs/app-latest.log`
- **Android:** `adb shell run-as so.onekey.app.wallet cat files/logs/app-latest.log > app-latest.log`

```bash
# iOS simulator: find latest log
LOG=$(find ~/Library/Developer/CoreSimulator/Devices \
  -path "*/Containers/Data/Application/*" \
  -name "app-latest.log" 2>/dev/null | xargs ls -t | head -1)

# Extract the startup timeline — the unified StartupTiming tag + a few
# adjacent signals (BgTransport, initCritical, Balance displayed, snapshot).
grep -E "StartupTiming|BgTransport.*(→|transport)|Balance displayed|\
OneKey started|initCritical|JotaiBgSync.*resolving|HomePageReady|\
MMKV context|BackgroundEntry" "$LOG" | tail -60
```

### Step 2: Unified Timing Schema

All native + JS startup timing lines carry tag `[StartupTiming]` with message format:
```
<label>: <duration>ms [(+<cumulative>ms from launch)] [context]
```

**Zero point (app launch):**
- iOS: `appLaunchCFTime` (module-load time in `AppDelegate.swift`)
- Android: `MainApplication.appLaunchMs` (first line of `MainApplication.onCreate()`)

**Shared labels** (appear on both platforms — use these for cross-platform comparisons):

| Label | Meaning | Where |
|---|---|---|
| `main_host.did_start` | Main RN host ready (bundle loaded, context initialized) | iOS: `hostDidStart:` callback / Android: `onReactContextInitialized` |
| `bg_runner.start` | Background thread runner kicked off | Right after main host ready |

**Android-only native labels:**

| Label | Meaning |
|---|---|
| `android.app.on_create.start` | Zero anchor |
| `android.zygote_to_app_on_create` | Invisible gap: zygote fork + ART init + dex2oat |
| `android.app.super_on_create` | `Application.super.onCreate()` duration |
| `android.app.so_loader_init` | `SoLoader.init()` duration |
| `android.app.new_arch_load` | `DefaultNewArchitectureEntryPoint.load()` duration |
| `android.app.bg_bootstrap` | `setupBackgroundThreadBootstrap` (just attaches listener, <1ms) |
| `android.app.expo_lifecycle` | `ApplicationLifecycleDispatcher.onApplicationCreate` — Expo modules |
| `android.app.jpush_register` | JPush registration |
| `android.app.on_create.done` | `Application.onCreate` total |
| `android.activity.on_create.{start,done}` | `MainActivity.onCreate` bracket |
| `android.activity.super_on_create` | ReactActivity init (inside `super.onCreate`) |

**iOS-only native labels:**

| Label | Meaning |
|---|---|
| `ios.app.did_finish_launching.start` | Zero anchor (first line inside `didFinishLaunching`) |
| `ios.app.jpush_register` | JPush registration |
| `ios.app.super_did_finish_launching` | `super.application(...)` — the big Expo/RN init block |
| `ios.app.did_finish_launching.done` | `didFinishLaunching` total |
| `ios.main_entry.deferred` | Deferred dispatch fired (before main.jsbundle eval) |
| `ios.main_entry.evaluated` | `main.jsbundle` native-side eval duration |

**JS-side labels (platform-agnostic):**

| Label | File | Meaning |
|---|---|---|
| `MMKV contextAtom snapshot pre-read` | `apps/mobile/index.ts` | Phase 1 done — snapshot on `globalThis` |
| `segment loader installed` | `apps/mobile/index.ts` | Prod split-bundle loader ready |
| `BG transport setup` (misleading label) | `apps/mobile/index.ts` | Actually main thread's `require('./App')` chain total |
| `main entry evaluated` | `apps/mobile/index.ts` | Main JS bundle top-level done |
| `Balance displayed` | Home page first paint | **Target TTI metric** |
| `[BackgroundEntry] polyfills loaded` | `apps/mobile/background.ts` | BG thread polyfills done |
| `[BackgroundEntry] backgroundApiProxy ready` | `apps/mobile/background.ts` | BG thread main module ready |
| `[BackgroundEntry] entry JS executed` | `apps/mobile/background.ts` | BG thread bundle done |

### Step 3: Expected Timelines

> All numbers below are **measured** on `codex/feat-split-background-thread`
> (commits `18c67990d7` + `ee1877d289`) on real devices, not estimates. Update
> when the build pipeline or App require-tree changes materially.

#### Android baseline — total ~2.4–3.2s tap-to-Balance (5-run sample)

Native phase anchors at `android.app.on_create.start` (first line of
`MainApplication.onCreate`). The tap → process-fork → zygote/ART/dex2oat
window happens **before** the anchor and is reported by
`android.zygote_to_app_on_create` for context, not added to "+from launch".

```
                                                               cold      warm
                                                               ----      ----
android.zygote_to_app_on_create                                147ms    88-91ms     (pre-anchor, OS overhead)
android.app.on_create.start: +0ms                              ── anchor ──
  android.app.super_on_create                                    1ms     1-3ms
  android.app.so_loader_init                                    14ms     8-19ms
  android.app.new_arch_load                                     94ms    71-94ms     ⚠ biggest in Application
  android.app.bg_bootstrap                                       2ms     2-3ms
  android.app.expo_lifecycle                                     0ms     0-1ms
  android.app.jpush_register                                     0ms     0ms
android.app.on_create.done                       +146ms    +110-141ms
                                                  (gap)     ~14-17ms      Activity stack-up
android.activity.on_create.start                 +160ms    +125-155ms
  android.activity.super_on_create               87ms      45-47ms      ⚠ biggest in MainActivity
android.activity.on_create.done                  +251ms    +172-204ms
                                                  (gap)     ~60-130ms     RN host instantiates ReactContext
main_host.did_start                              +379ms    +312-333ms    ← native runtime ready
bg_runner.start                                  +382ms    +315-338ms

── JS phase begins (separate clock from __ONEKEY_MAIN_ENTRY_START__) ──
[BackgroundEntry] polyfills loaded                +116ms (from JS entry)
MMKV contextAtom snapshot pre-read: 10 keys       +121ms (Phase 1)
segment loader installed                          +122ms
[StartupTiming] BG transport setup                +1821ms      ← actually require('./App') chain
main entry evaluated                              +1822ms
[BackgroundEntry] backgroundApiProxy ready        +2028ms
Balance displayed                                 +2073-2693ms ← target TTI
```

**Android phase budget:**
| Phase | Cold | Warm | Notes |
|---|---|---|---|
| Pre-anchor (zygote→onCreate) | ~150ms | ~90ms | OS, not optimizable |
| Application.onCreate | ~146ms | ~110-141ms | `new_arch_load` is 70-90% of this |
| MainActivity.onCreate | ~91ms | ~47ms | `super.onCreate` is ~95% |
| ReactContext init gap | ~130ms | ~110ms | RN host + common bundle |
| **Native subtotal (anchor → main_host.did_start)** | **~380ms** | **~315-340ms** | |
| JS entry → Balance | ~2700ms | ~2100ms | `require('./App')` is ~85% |
| **TTI from anchor** | **~3.1s** | **~2.4-2.5s** | |
| Add pre-anchor for visual estimate | +150ms | +90ms | |

#### iOS baseline — total ~?s tap-to-Balance (TBD, awaiting fixed build)

> ⚠ The first iOS instrumented build (commit `18c67990d7`) had a Swift
> lazy-init bug: `appLaunchCFTime` was a module-level `let` that only
> initialized on first read (now in `didFinishLaunching`), collapsing every
> "+from launch" to ~0ms. Fixed in `ee1877d289` by moving the anchor to
> `AppDelegate.appLaunchCFTime` (`static let`) and force-evaluating it inside
> `AppDelegate.init()`. Re-baseline iOS once the new build is on a device.

Approximate iOS timeline shape (deltas between phases are reliable from the
buggy build; absolute "+from launch" needs the fixed build):

```
ios.app.did_finish_launching.start                +Xms (was 0 due to lazy bug)
  main_host.did_start (common bundle loaded)      +X+14ms
  bg_runner.start                                  +X+14ms
  ios.app.jpush_register                            2ms
  ios.app.super_did_finish_launching                0ms     ← RN init happens in factory.startReactNative, not super
ios.app.did_finish_launching.done                +X+22ms
ios.main_entry.deferred                          +X+34ms   (defer delay ~21ms)
ios.main_entry.evaluated                         +X+41ms   (just dispatch — async load)

── JS phase ──
[BackgroundEntry] polyfills loaded                +51ms (from JS entry)
[StartupTiming] BG transport setup                +844ms       ← ~1ms/2 of Android
[StartupTiming] main entry evaluated              +844ms
[BackgroundEntry] backgroundApiProxy ready        +767ms
Balance displayed                                 +1077-1127ms (warm) ← target TTI
```

**iOS vs Android (warm restart medians, JS side):**
| Metric | iOS | Android | Ratio |
|---|---|---|---|
| Balance displayed (from JS entry) | ~1100ms | ~2200ms | 2.0× |
| BG transport setup (`require('./App')` chain) | ~790ms | ~1700ms | 2.2× |
| backgroundApiProxy ready (BG thread) | ~720ms | ~1500ms | 2.1× |
| `[BackgroundEntry] polyfills loaded` | ~51ms | ~115ms | 2.3× |

**Conclusion:** Hermes-iOS executes the same JS bundle ~2× faster than
Hermes-Android on this device. JS parse time is the dominant cost on both
platforms (75-85% of total cold start), much larger than any native phase.

### Step 4: Common Regression Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Balance displayed` 2x+ slower (JS-side drift) | Phase 2 hydration broken — atoms start empty, wait for network | Check `contextAtomBase` reads `__ONEKEY_CTX_ATOM_SNAPSHOT__` |
| Snapshot pre-read shows 0 keys | Phase 3 save broken — previous session didn't flush | Check `flushColdStartCache`, AppState listener |
| Snapshot pre-read missing entirely | Phase 1 not executing or MMKV not available | Check `index.ts` entry, `coldStartCacheStorage` instance |
| `main_host.did_start` regresses | Native/bundle load slower — common bundle growth, or Hermes/TurboModule init slower | Check `common.jsbundle` size; check `android.app.*` / `ios.app.super_did_finish_launching` for where |
| `main_host.did_start` OK but `Balance displayed` slow | JS `require('./App')` or React mount got slower | Check `main entry evaluated` delta, new synchronous `require` in App tree |
| Android-only slow, iOS OK | `android.app.*` phase regression (SoLoader, new-arch load, Expo lifecycle) | Compare phase durations against baseline |
| `ios.main_entry.deferred → evaluated` huge gap | main.jsbundle grew, or dispatch scheduling pressure | Re-check bundle composition, `unionBuild.js` output |
| `Balance displayed` OK but layout shift | Cached data shape mismatch — partial hydration | Check `resolvedInitialValue` merge logic |
| Memory growth over sessions | Snapshot blob growing unbounded | Check snapshot key count, consider LRU eviction |

### Step 5: Verify SSR Pipeline

```bash
# 1. Check Phase 1 executed
grep "MMKV contextAtom snapshot pre-read" "$LOG"
# Expected: "N keys (+XXXms)"

# 2. Check Phase 2 hydration (no explicit log; if Balance displayed is
#    within baseline, hydration is working)

# 3. Check Phase 3 save (cold start cache flush after balance)
grep "ColdStartCache" "$LOG"

# 4. Check cleanup timing
grep "HomePageReady" "$LOG"

# 5. Cross-platform comparison: line up the shared milestones
grep -E "StartupTiming.*(main_host\.did_start|bg_runner\.start)" "$LOG"

# 6. Pull a single-session timing table (sorted)
grep 'StartupTiming' "$LOG" | awk -F'\\] ' '{print $NF}' | head -40
```

### Step 6: Parse for Tracking / Regression Dashboard

Since all native + JS timing lines share the `[StartupTiming]` tag with a consistent
`<label>: <detail> (+<cumulative>ms from launch)` shape, a minimal parser is:

```bash
# Extract label → cumulative_ms pairs
grep 'StartupTiming' "$LOG" \
  | sed -E 's/.*\[StartupTiming\] ([a-z0-9_.]+).*\+([0-9]+)ms from launch.*/\1\t\2/' \
  | grep -v 'StartupTiming'  # drop lines without cumulative
```

Feed into a time-series store (Sentry, internal dashboard, etc.) keyed by label
to spot per-phase regressions over builds.

## Critical Rules

1. **Never remove Phase 2 module-load-time hydration** — this is the core of the SSR pattern. Without it, atoms start empty and the app waits for network (~2s regression).

2. **Never use `setTimeout(0)` for snapshot cleanup** — split-bundle modules load asynchronously and need the snapshot. Use `HomePageReady` event.

3. **Always use read-modify-write in `flushColdStartCache`** — full overwrite drops cached values for unrendered scopes (e.g., different accounts).

4. **Phase 1 must execute before any `contextAtomBase`** — the snapshot must be on `globalThis` before modules evaluate. Place it at the very top of `index.ts`.

5. **`coldStartCacheStorage` is a separate MMKV instance** — isolated from app settings to prevent contention with unrelated writes.

## MMKV Storage Map

```
jotaiMMKV (per-key)              ← globalAtom persistence
  "jotai:settingsPersistAtom"
  "jotai:accountSelectorAtom"
  "mmkv_migration_complete" = "1"

coldStartCacheStorage (blob)     ← contextAtom cold start SSR
  "onekey_jotai_context_atoms_snapshot" = JSON blob
    { "scopeA:ctx:tokenListAtom": {...}, "scopeA:ctx:accountWorthAtom": {...} }

syncStorage                      ← app settings, dev flags, SWR cache
  "onekey_swr_cache"
  "onekey_pending_install_task"
  ...
```

## Future: Desktop/Web/Extension Support

Currently native-only. To extend to other platforms:

1. **Desktop (Electron):** `electron-store` is synchronous — same pattern applies. Replace MMKV reads with electron-store reads in Phase 1.
2. **Web:** Use `localStorage.getItem()` (synchronous) in Phase 1. Phase 3 writes via `localStorage.setItem()`.
3. **Extension:** Extension background persists via chrome.storage. UI popup can read from `localStorage` for sync Phase 1. Cross-context sync via `__ONEKEY_JOTAI_INIT_STATES__` (existing mechanism).

Key requirement for all platforms: Phase 1 must be **synchronous** and execute before module evaluation.
