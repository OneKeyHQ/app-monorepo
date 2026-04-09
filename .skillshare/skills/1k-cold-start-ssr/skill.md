---
name: 1k-cold-start-ssr
description: "Jotai Cold Start SSR — cold start optimization via MMKV snapshot hydration for OneKey native app. Use when debugging startup performance regressions, analyzing cold start timeline, or modifying the snapshot hydration pipeline. Triggers on: cold start, startup optimization, SSR hydration, Balance displayed regression, MMKV snapshot, contextAtomBase, flushColdStartCache, __ONEKEY_CTX_ATOM_SNAPSHOT__."
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

NativeLogger writes to `Library/Caches/logs/app-latest.log` on device/simulator.

```bash
# Find the log file
find ~/Library/Developer/CoreSimulator/Devices \
  -path "*/Containers/Data/Application/*" \
  -name "app-latest.log" 2>/dev/null

# Extract startup milestones for the latest session
grep -E "StartupTiming|BgTransport.*(→|transport)|SplitBundle.*hostDidStart|\
Balance displayed|OneKey started|initCritical|JotaiBgSync.*resolving|\
HomePageReady|MMKV context|segment loader" "$LOG" | tail -40
```

### Step 2: Expected Timeline (baseline ~1550ms)

```
+0ms     [App] OneKey started
+3ms     BG thread start
+100ms   main entry deferred dispatch
+102ms   main entry evaluated (native → JS handoff)
+455ms   MMKV contextAtom snapshot pre-read: 7 keys     ← Phase 1
+455ms   segment loader installed
+496ms   MMKV per-key ready (JotaiBgSync)
+1175ms  BG hostDidStart (apiProxy import: ~700ms)
+1261ms  BG transport → ready
+1300ms  initCriticalDone (localDb + locale: ~39ms)
+1550ms  Balance displayed                               ← Target metric
```

### Step 3: Common Regression Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Balance displayed 2x+ slower | Phase 2 hydration broken — atoms start empty, wait for network | Check `contextAtomBase` reads `__ONEKEY_CTX_ATOM_SNAPSHOT__` |
| Snapshot pre-read shows 0 keys | Phase 3 save broken — previous session didn't flush | Check `flushColdStartCache`, AppState listener |
| Snapshot pre-read missing entirely | Phase 1 not executing or MMKV not available | Check `index.ts` entry, `coldStartCacheStorage` instance |
| Balance displayed OK but layout shift | Cached data shape mismatch — partial hydration | Check `resolvedInitialValue` merge logic |
| Memory growth over sessions | Snapshot blob growing unbounded | Check snapshot key count, consider LRU eviction |

### Step 4: Verify SSR Pipeline

```bash
# 1. Check Phase 1 executed
grep "MMKV contextAtom snapshot pre-read" "$LOG"
# Expected: "7 keys (+XXXms)"

# 2. Check Phase 2 hydration (no explicit log, but if Balance displayed
#    is fast (~1550ms), hydration is working)

# 3. Check Phase 3 save (look for cold start cache flush after balance)
grep "ColdStartCache" "$LOG"

# 4. Check cleanup timing
grep "HomePageReady" "$LOG"
```

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
