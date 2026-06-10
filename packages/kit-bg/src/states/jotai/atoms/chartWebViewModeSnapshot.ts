import { useEffect, useSyncExternalStore } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { devSettingsPersistAtom } from './devSettings';
import { chartSourcePersistAtom } from './tradingView';

import type { IChartSourcePersistAtom } from './tradingView';

// Cold-start snapshot of the persisted chart-source decision (Part B2).
//
// `CHART_WEBVIEW_MODE` used to be a build-time constant. It is now resolved at
// runtime from the server-driven decision persisted in `chartSourcePersistAtom`
// — BUT it must NOT be read as an async atom inside render (that would jitter
// and break the pooled single-WebView's source invariance). Instead the
// decision is read ONCE early in cold start into this synchronous module
// snapshot, and every consumer reads the snapshot synchronously.
//
// The snapshot is LOCKED for the whole session: a fresh API result is persisted
// for next cold start, never hot-applied (the pooled singleton is long-lived
// across hosts, so the source/namespace/reuseKey must stay stable).

export type IChartWebViewMode = 'legacy' | 'offline' | 'online';

// Mirrors the offline default of `chartSourcePersistAtom`.
const DEFAULT_SNAPSHOT: IChartSourcePersistAtom = {
  online: false,
  decidedForVersion: '',
  fetchedAt: 0,
};

let snapshot: IChartSourcePersistAtom = DEFAULT_SNAPSHOT;
// QA-only dev override (Part L1), captured ONCE into the cold-start snapshot
// alongside the server decision. `undefined` = follow the snapshot logic;
// 'offline'/'legacy' force the mode. Locked for the session like the snapshot,
// so flipping it in dev settings only takes effect after an app restart.
let devModeOverride: 'offline' | 'legacy' | undefined;
// Whether the cold-start read has completed. Chart / prewarm hosts MUST NOT
// mount until this is true, so they never read an uninitialized snapshot (the
// ready barrier — Gate 2). `serviceBootstrap.init()` is fire-and-forget and
// prewarm can out-race it, hence the explicit barrier.
let initialized = false;
// In-flight init promise, so concurrent callers share one execution (see
// initChartWebViewModeSnapshot). Stays set after completion; harmless because
// the `initialized` short-circuit returns before it is read again.
let initPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/**
 * Resolve the effective chart-webview mode from the cold-start snapshot.
 *
 * - dev (non-production): always `'online'` (dev/internal builds don't stage
 *   the offline assets, so loading offline would white-screen) — unchanged.
 * - prod: `'online'` only when the server decided online FOR THIS EXACT app
 *   version (the version match is the reset safety net — a stale decision from a
 *   previous version is ignored and falls back to offline); otherwise
 *   `'offline'`.
 *
 * Reads the synchronous snapshot, so it is safe to call inside render. The
 * value is locked for the session (snapshot does not change after init).
 */
export function getChartWebViewMode(): IChartWebViewMode {
  // Part L1: the QA dev override wins over everything (server/snapshot/dev
  // default). Captured into the cold-start snapshot, so it is stable for the
  // whole session (only an app restart re-reads it).
  if (devModeOverride === 'legacy' || devModeOverride === 'offline') {
    return devModeOverride;
  }
  if (!platformEnv.isProduction) {
    return 'online';
  }
  const s = snapshot;
  return s.online && s.decidedForVersion === platformEnv.version
    ? 'online'
    : 'offline';
}

// True once the cold-start snapshot read has completed (the ready barrier).
export function isChartBootSnapshotInitialized(): boolean {
  return initialized;
}

/**
 * Read the persisted decision ONCE into the synchronous module snapshot and
 * flip the ready barrier. Called early in cold start
 * (`ServiceBootstrap.initCritical()`, right after `localDb.readyDb`) so it runs
 * before any chart / prewarm host mounts. Idempotent and never throws — on any
 * failure it keeps the offline default and still marks the snapshot ready (so
 * the chart never deadlocks waiting on a failed read).
 */
export async function initChartWebViewModeSnapshot(): Promise<void> {
  if (initialized) {
    return;
  }
  // Coalesce concurrent callers (multiple chart hosts can mount in the same
  // frame on mobile, each firing this from `useChartBootSnapshotReady`). Without
  // this, every concurrent caller would race past the `initialized` guard before
  // the first one sets it, re-reading MMKV and emitting duplicate
  // `chartModeDecision` diagnostics. Share a single in-flight promise instead.
  if (!initPromise) {
    initPromise = doInitChartWebViewModeSnapshot();
  }
  return initPromise;
}

async function doInitChartWebViewModeSnapshot(): Promise<void> {
  try {
    snapshot = await chartSourcePersistAtom.get();
  } catch {
    // Keep the offline default — never block the ready barrier on a read error.
    snapshot = DEFAULT_SNAPSHOT;
  }
  try {
    // Capture the QA dev override (Part L1) into the locked snapshot too.
    // Gate on `dev.enabled` (mirroring `ignoreServerBundleUpdate` in
    // ServiceAppUpdate.ts) so a stale override from a once-enabled dev mode can
    // never leak into a production build.
    const dev = await devSettingsPersistAtom.get();
    const override = dev?.settings?.chartWebViewModeOverride;
    devModeOverride =
      dev?.enabled && (override === 'offline' || override === 'legacy')
        ? override
        : undefined;
  } catch {
    devModeOverride = undefined;
  }
  initialized = true;
  // Diagnostic (Part B2): log the one-shot mode decision exactly ONCE, here in
  // the snapshot init (never in getChartWebViewMode, which runs in render and
  // would flood the log). resolvedMode mirrors getChartWebViewMode()'s logic
  // exactly: dev override > !isProduction => online > server-online &&
  // version-match => online > offline.
  const versionMatch = snapshot.decidedForVersion === platformEnv.version;
  let resolvedMode: IChartWebViewMode;
  if (devModeOverride === 'legacy' || devModeOverride === 'offline') {
    resolvedMode = devModeOverride;
  } else if (!platformEnv.isProduction) {
    resolvedMode = 'online';
  } else {
    resolvedMode = snapshot.online && versionMatch ? 'online' : 'offline';
  }
  defaultLogger.market.chart.chartModeDecision({
    platform: platformEnv.appPlatform ?? 'native',
    isProduction: !!platformEnv.isProduction,
    serverOnline: snapshot.online,
    decidedForVersion: snapshot.decidedForVersion,
    currentVersion: platformEnv.version ?? '',
    versionMatch,
    devOverride: devModeOverride,
    resolvedMode,
  });
  emit();
}

/**
 * Subscribe to the ready barrier so React hosts re-render when the cold-start
 * snapshot becomes available. Chart / prewarm hosts gate their mount on this.
 *
 * Cross-runtime fix: on mobile the UI/main thread runs a SEPARATE Hermes runtime
 * from the background thread. `initChartWebViewModeSnapshot()` is only called by
 * `ServiceBootstrap` in the BACKGROUND runtime, so the UI runtime's module-static
 * `initialized` would stay false forever and every chart host would silently fall
 * back to the legacy webview (the chart-webview native module never mounts).
 *
 * To fix this WITHOUT a bridge round-trip, this hook lazily kicks off the snapshot
 * init in whatever runtime it is rendered in. The init reads the persisted decision
 * straight from MMKV (`chartSourcePersistAtom` / `devSettingsPersistAtom` are
 * native per-key MMKV-hydrated globalAtoms shared by both runtimes), so the UI
 * runtime resolves the SAME correct mode the background runtime decided once the
 * AsyncStorage->MMKV migration is complete (the steady state for upgraded
 * devices). Before migration completes (fresh install / failed prior migration)
 * the UI runtime falls back to the offline DEFAULT — the safe default, never a
 * wrong online decision. The init is idempotent (`if (initialized) return`) and
 * never throws, so on single-runtime
 * platforms (web / desktop / extension) — where `ServiceBootstrap` already ran it —
 * this is a harmless no-op. The `emit()` inside the init flips this
 * `useSyncExternalStore` so consumers re-render once it completes.
 */
export function useChartBootSnapshotReady(): boolean {
  const ready = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => initialized,
    () => initialized,
  );
  useEffect(() => {
    // Idempotent + never-throws by contract; fire-and-forget so the gate flips
    // in this runtime even when nobody else initialized it (the UI/main thread).
    if (!initialized) {
      void initChartWebViewModeSnapshot();
    }
  }, []);
  return ready;
}
