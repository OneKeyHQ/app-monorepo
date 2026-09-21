---
name: 1k-ui-snapshot-cache
description: "UI snapshot cache (display-only, main-thread) + unified startup timing schema — cold-start reads from snapshot namespaces (MMKV on native, IndexedDB on web) and the cross-platform `[StartupTiming]` log taxonomy. Use when adding or debugging a UI snapshot / SWR cache, debugging startup performance regressions, analyzing cold start timeline, or comparing iOS vs Android startup phases. Triggers on: ui snapshot cache, SnapshotCache, swr cache, usePromiseResult cache, cold start, startup optimization, 启动时间, SSR hydration, Balance displayed regression, contextAtomBase, flushColdStartCache, __ONEKEY_CTX_ATOM_SNAPSHOT__, StartupTiming, main_host.did_start, bg_runner.start."
disable-model-invocation: true
---

# UI Snapshot Cache

Where the app keeps what it last displayed, so a screen paints before its
fetch returns. Analogous to web SSR hydration: the values are persisted, read
back synchronously at startup, and used as the initial value.

The persistence layer is the **UI snapshot store**: a set of namespaces, each
with its own file (native) or key range (web/desktop), each with its own
retention. Two consumers sit on top of it — the Jotai context-atom snapshot
and the SWR cache (`usePromiseResult`).

**Supported on:** native (iOS/Android), web, desktop, extension. The single
shared cold-start store that preceded this — `coldStartCacheStorage` plus the
`onekey_swr_cache` blob — is gone, so one feature's cache can no longer evict
another's and a startup read no longer opens a file every feature writes.

## Rules

1. **The cache belongs to the main thread.** The UI runtime owns its reads,
   writes and removals. bg does not write these namespaces — it has no hook to
   own an entry and no key to name it by. Desktop and web run one runtime,
   which is that owner.
2. **On a mutation, refresh or remove — never patch.** After creating,
   updating or editing an entity, refresh the hook that owns the entry
   (`run({ alwaysSetState: true })`) and let the SWR layer persist what the
   fetcher returned. After deleting one, remove its entry. What is forbidden is
   maintaining a value by hand — a `set` with a locally assembled object, or a
   patch to an entry belonging to another screen's hook. Do it in the UI
   runtime: there is normally no reason to route this through bg, and that
   detour gives one namespace two writers over one file with no lock between
   the runtimes.
3. **Cold start reads it directly.** The first frame reads a record
   synchronously, without waiting for bg: MMKV on native, and on web/desktop
   the map that hydration primes before React mounts. A read names its key, so
   a screen loads its own record and nothing else.
4. **Nothing sensitive goes in it.** Passwords and password-control state,
   master-password material, keys, mnemonics, auth tokens: fetched from bg on
   every read, never persisted here. This store is read off disk before any
   authentication has happened, and what it holds is display data that is safe
   to show stale.

## Storage Layers

```
feature code
  │
  ├── uiSnapshotCaches.ts          ctx-atom-snapshot, account-selector,
  │                                tokenlist-maintenance
  ├── marketSnapshotCaches.ts      market-token-detail
  └── swrCacheUtils                swr-<name> (one per SWR key prefix)
        │
        ▼
  SnapshotCache                    manifest + records, per-namespace retention
   (createNamespacedSnapshotCache) records at `d:<key>`, manifest at `manifest`
        │
        ▼
  DisplaySnapshotStorage
   native  → one MMKV instance per namespace: onekey-display-snapshot-<ns>
   web/dsk → one IndexedDB database `onekey-ui-snapshot`, keys `<ns>:<key>`,
             behind an in-memory map with a 2s debounced write-behind flush
```

**Files:**

| Concern | File |
|---|---|
| Namespace registry | `packages/shared/src/storage/SnapshotCache/snapshotCacheNamespaces.ts` |
| Cache semantics (manifest, retention, sweep) | `packages/shared/src/storage/SnapshotCache/createSnapshotCacheSync.ts` |
| Native backend (MMKV) | `packages/shared/src/storage/DisplaySnapshotStorage/createDisplaySnapshotStorage.native.ts` |
| Web backend (IndexedDB + map) | `packages/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore.ts` |
| Feature-declared namespaces | `packages/shared/src/storage/uiSnapshotCaches.ts` |
| SWR namespace mapping | `packages/shared/src/utils/swrCacheNamespaceStorage.ts` |

**Namespace registry:** every namespace must appear in
`SNAPSHOT_CACHE_NAMESPACES` — "clear data" and the idle sweep need the whole
set before the modules that use them are imported, and a missing namespace is
invisible to both.

**Reads name a key.** `get(key)` reads one record: no manifest read, no
enumeration. That is what lets a namespace hold many entries cheaply.

## Jotai Context-Atom Snapshot

The scoped values a provider rendered last session, serialized as one record
in the `ctx-atom-snapshot` namespace (`maxEntries: 1`, 30 days).

### Save

**File:** `packages/kit-bg/src/states/jotai/utils/index.ts`

```typescript
// flushColdStartCache(): read-modify-write, patching only dirty keys so the
// scopes this session never rendered keep their cached values.
const raw = readContextAtomSnapshotRaw();
const snapshot = parseColdStartSnapshotRaw(raw) ?? {};
for (const name of coldStartDirtyKeys) {
  snapshot[name] = coldStartValuesMap.get(name);
}
writeContextAtomSnapshotRaw(prepareColdStartSnapshotForWrite(snapshot).serialized);
```

Triggers: `scheduleColdStartSave()` (debounced 2s after any tracked atom
change) and the app-background flush.

### Hydrate

- **Native:** `hydrateContextColdStartCacheForProvider()` reads it when a
  provider mounts — from `globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__` if
  something already parsed it, otherwise straight from MMKV via
  `readContextAtomSnapshotRaw()`. MMKV is sync, so no entry-point pre-read.
- **Web/desktop:** `packages/kit-bg/src/hydration/hydrate.ts` parses it during
  startup and publishes `globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__` before React
  mounts. IndexedDB is async, which is why that module exists at all.

`__ONEKEY_CTX_ATOM_SNAPSHOT__` is cleaned up on `HomePageReady` (first screen
rendered), never on `setTimeout(0)`: split-bundle modules load asynchronously
and still need it.

### Cache keys

Each participating context atom declares a `coldStartCacheKey` registered in
`CONTEXT_ATOM_COLD_START_CACHE_KEYS` (`packages/shared/src/consts/jotaiConsts.ts`):

```typescript
const { atom: renderedTokenListCacheAtom } = contextAtom<ITokenListValue>(
  defaultValue,
  {
    coldStartCache: true,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.renderedTokenListCacheAtom,
  },
);
```

Snapshot keys are scoped per provider: `{scopeKey}::{coldStartCacheKey}`, e.g.
`hd-1--0::ctx:renderedTokenListCacheAtom`. `scopeKey` comes from
`store.__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__`.

**Adding one:** add the key to the const, pass
`{ coldStartCache: true, coldStartCacheKey }` to `contextAtom()`. Tracking and
saving are automatic. Only cache values that are safe to show stale — never
security-sensitive or time-critical data.

## Native Jotai Fast Hydration

**File:** `packages/kit-bg/src/states/jotai/jotaiInitFromNativeStorage.native.ts`

The background runtime owns the global atoms and remains the only writer, but
what it sends back at startup is a copy of a file the UI runtime can read
itself. `hydrateJotaiFromNativeStorage()` reads `jotaiMMKV` directly on the
main runtime and injects the values through the same snapshot path the RPC
hydration uses, which takes bg's boot off the front of the first frame. The
RPC hydration still runs afterwards and stays canonical.

It steps aside rather than guessing when it cannot be sure the file is the
truth: Travel Mode, a store that has not finished migrating off AsyncStorage
(`mmkv_migration_complete !== '1'`), or an empty store.

## Web / Desktop Startup

**File:** `packages/kit-bg/src/hydration/hydrate.ts` — loaded as the first
module after polyfills in `apps/web/index.js` and `apps/desktop/index.js`, and
run at module load so the hydration promise is fired before React mounts.

In order:

1. Reads only the namespaces the first frame needs, as key ranges:
   `ctx-atom-snapshot`, `account-selector` (its recent-selection guard decides
   which account home opens with) and the store's own markers.
2. On a build-hash mismatch — or an unmarked database that already holds
   records — wipes every namespace and writes the new marker eagerly.
3. Primes the in-memory map those namespaces are read from.
4. Publishes `globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__`.
5. Primes every other namespace *after* the gate resolves. A page reads its own
   namespace by exact key when it opens, so a slow database makes those land
   late rather than not at all.
6. Resolves the ready gate in `finally`, so React mounts even on failure.

Bounded by `HYDRATION_TIMEOUT_MS` (300ms). Degrades to defaults on: dev mode
(schema drift), the `__cold_start_kill__` localStorage switch, private mode /
quota 0, build-hash mismatch, or a stalled database. Telemetry lands in
`globalThis.__ONEKEY_COLD_START_RESULT__`:
`'success' | 'timeout' | 'error' | 'killed' | 'skipped'`.

## SWR Cache (usePromiseResult)

Results of `usePromiseResult` hooks, so a screen revisit paints before its
fetch returns.

**File:** `packages/shared/src/utils/swrCacheUtils.ts`

```typescript
const swrCacheEntry = swrCacheUtils.getWithTimestamp<T>(swrKey);
const effectiveInitResult =
  swrCacheEntry !== undefined ? swrCacheEntry.data : options.initResult;
```

- One namespace per SWR key prefix (`swr-<name>`), plus `swr-other` for keys
  whose prefix names no known namespace. Key builders are centralized in
  `swrKeys`.
- Namespace retention: 200 entries / 7 days, on top of the in-memory budgets
  in `swrCacheLimits`.
- Debounced 2s flush, plus an immediate flush when the app backgrounds.
- A runtime keeps its own in-memory copy of what it has read. Nothing reloads
  it from disk, so a write by the other runtime is not visible until the next
  launch; revalidation on mount is what keeps a value from going stale.

### Who writes an entry

`usePromiseResult` — it persists what its fetcher returned, in the runtime that
owns the hook. See **Rules** above; the history behind them:

- bg once primed `unifiedNetworkSelectorMeta` after a network toggle, giving
  that namespace two writers over one MMKV file with no lock. The selector
  refreshes itself instead. Routing a bg write *through* the UI runtime is not
  a fix either: on the extension the bus reaches every open foreground, so the
  routing turns one writer into one per surface.
- Removals bg still triggers travel as announcements over
  `SwrCacheInvalidated`: it deletes nothing, and the owner performs the delete
  and drops its own pending writes for those keys, so nothing it queued
  outlives the removal. The owner never announces in turn — an announcement
  answered with an announcement loops between foregrounds.

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
- `main.jsbundle` (10.1MB): async eval ~1300ms — **the single biggest bottleneck** (87% of total startup), so anything added to it lands on that number
- `background.bundle` (20.7MB): parallel, apiProxy import ~700ms — non-blocking but close to the critical path (BG ready +1261ms vs main eval +1300ms), and a blocker if it ever overtakes it
- Segments: icon ~25ms each, vault settings ~20ms each, on demand after first render. Move non-critical code into them; analyze with `apps/mobile/scripts/unionBuild.js`

## Key Differences: contextAtom vs globalAtom

| | contextAtom (scoped) | globalAtom (singleton) |
|---|---|---|
| Examples | tokenListAtom, accountWorthAtom | settingsPersistAtom |
| Cold start source | `ctx-atom-snapshot` namespace (via `__ONEKEY_CTX_ATOM_SNAPSHOT__` on web) | `jotaiMMKV` per-key direct read |
| Storage | one UI snapshot record | `jotaiMMKV` per-key |
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

> ⚠ The first iOS instrumented build (`18c67990d7`) had a Swift lazy-init bug
> that collapsed every "+from launch" to ~0ms; fixed in `ee1877d289` by
> force-evaluating `AppDelegate.appLaunchCFTime` in `init()`. Phase *deltas*
> below are reliable; absolute "+from launch" needs a re-baseline.

```
ios.app.did_finish_launching.start                +Xms
  main_host.did_start / bg_runner.start           +X+14ms
  ios.app.super_did_finish_launching                0ms  ← RN init is in factory.startReactNative
ios.app.did_finish_launching.done                +X+22ms
ios.main_entry.deferred / .evaluated             +X+34ms / +X+41ms (async load)

── JS phase ──
[BackgroundEntry] polyfills loaded                +51ms (from JS entry)
[StartupTiming] BG transport setup / main entry   +844ms
[BackgroundEntry] backgroundApiProxy ready        +767ms
Balance displayed                                 +1077-1127ms (warm) ← target TTI
```

**iOS vs Android (warm restart medians, JS side):** Balance displayed
~1100ms vs ~2200ms, BG transport setup ~790 vs ~1700, apiProxy ready ~720 vs
~1500, polyfills ~51 vs ~115 — Hermes-iOS runs the same bundle ~2× faster on
this device. JS parse dominates on both (75-85% of cold start), far above any
native phase.

### Step 4: Common Regression Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Balance displayed` 2x+ slower (JS-side drift) | Hydration broken — atoms start empty and wait for the network | Check that the provider hydration reads the `ctx-atom-snapshot` record |
| Snapshot empty on a warm device | Save broken — the previous session never flushed | Check `flushColdStartCache` and the app-background trigger |
| `main_host.did_start` regresses | Native/bundle load slower — common bundle growth, or Hermes/TurboModule init slower | Check `common.jsbundle` size; check `android.app.*` / `ios.app.super_did_finish_launching` for where |
| `main_host.did_start` OK but `Balance displayed` slow | JS `require('./App')` or React mount got slower | Check `main entry evaluated` delta, new synchronous `require` in App tree |
| Android-only slow, iOS OK | `android.app.*` phase regression (SoLoader, new-arch load, Expo lifecycle) | Compare phase durations against baseline |
| `ios.main_entry.deferred → evaluated` huge gap | main.jsbundle grew, or dispatch scheduling pressure | Re-check bundle composition, `unionBuild.js` output |
| `Balance displayed` OK but layout shift | Cached data shape mismatch — partial hydration | Check `resolvedInitialValue` merge logic |
| Memory growth over sessions | Snapshot blob growing unbounded | Check snapshot key count, consider LRU eviction |

### Step 5: Verify SSR Pipeline

```bash
# 1. Check hydration (no explicit log; if Balance displayed is within
#    baseline, the snapshot was read)

# 2. Check the save path (cold start cache flush after balance)
grep "ColdStartCache" "$LOG"

# 3. Check cleanup timing
grep "HomePageReady" "$LOG"

# 5. Cross-platform comparison: line up the shared milestones
grep -E "StartupTiming.*(main_host\.did_start|bg_runner\.start)" "$LOG"

# 6. Pull a single-session timing table (sorted)
grep 'StartupTiming' "$LOG" | awk -F'\\] ' '{print $NF}' | head -40
```

### Step 6: Parse for Tracking / Regression Dashboard

```bash
grep 'StartupTiming' "$LOG" \
  | sed -E 's/.*\[StartupTiming\] ([a-z0-9_.]+).*\+([0-9]+)ms from launch.*/\1\t\2/' \
  | grep -v 'StartupTiming'   # drop lines without a cumulative value
```

Feed label → cumulative_ms into a time-series store keyed by label to spot
per-phase regressions across builds.

## Critical Rules

1. **Never remove module-load-time hydration** — reading the snapshot when the
   atom is first created is the pattern. Without it, atoms start empty and the
   app waits for the network (~2s regression).

2. **Never use `setTimeout(0)` for snapshot cleanup** — split-bundle modules
   load asynchronously and still need it. Use `HomePageReady`.

3. **Always read-modify-write in `flushColdStartCache`** — a full overwrite
   drops the scopes this session never rendered (e.g. another account).

4. **One writer per namespace.** A namespace is one file (native) or one key
   range (web) shared by every runtime that opens it, and nothing locks across
   runtimes. See the SWR writing rule above; the same applies to any feature
   namespace.

5. **Register every namespace** in `SNAPSHOT_CACHE_NAMESPACES`, or "clear data"
   and the idle sweep will not see it.

## Storage Map

```
jotaiMMKV (per-key)                    ← globalAtom persistence
  "jotai:settingsPersistAtom"
  "mmkv_migration_complete" = "1"      ← the marker native fast hydration checks

UI snapshot namespaces                 ← everything display-only
  native:  onekey-display-snapshot-<namespace>   (one MMKV file each)
  web/dsk: onekey-ui-snapshot                    (one IndexedDB database,
                                                  keys `<namespace>:<key>`)

  ctx-atom-snapshot       1 record, 30d   contextAtom cold start
  account-selector        1 record, 30d   recent selection (read before first frame)
  tokenlist-maintenance   4 records, 30d  one-time maintenance markers
  market-token-detail                     market detail snapshots
  swr-<name> / swr-other  200 rec., 7d    usePromiseResult results

syncStorage                            ← app settings, dev flags
```
