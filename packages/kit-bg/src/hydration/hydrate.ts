// Cold-start hydration entry for web. Loaded as the first module after
// polyfills in `apps/web/index.js` (and `apps/desktop/index.js`); runs at
// module load so the hydration promise is fired before React mounts.
//
// L1 (per-atom globalAtom mirror) was REMOVED to avoid duplicating sensitive
// PersistAtom fields (sensitiveEncodeKey, encryptedSecurityPasswordR1) into
// a second IDB store. Web/desktop globalAtoms now reconcile asynchronously
// via jotaiInit (same as the pre-PR behavior) — short flicker is accepted
// in exchange for keeping sensitive material in a single store. L2 (context
// atom snapshot) and L3 (SWR cache) remain because they introduce *new*
// persistence channels rather than mirroring existing source-of-truth data.
//
// Storage isolation: the cold-start IDB lives in its own bucket on
// Chromium (Chrome / Edge / Electron) via navigator.storageBuckets, and in
// the default-origin IDB factory on Firefox / Safari. See
// packages/shared/src/storage/instance/webColdStartStorage.ts for the
// browser support matrix.
//
// What this module does (in module-load order):
//   1. Opens IndexedDB('onekey-cold-start-cache') and reads all entries.
//   2. On build-hash mismatch (or legacy unmarked DB with real entries),
//      clears the DB and writes the new marker eagerly (bounded force-
//      flush) so the very next reload sees a marked DB.
//   3. Primes the in-memory map that backs webColdStartStorage so all
//      synchronous reads by swrCacheUtils / coldStartCacheStorage succeed.
//   4. Populates globalThis.__ONEKEY_CTX_ATOM_SNAPSHOT__ (L2) from the
//      'onekey_jotai_context_atoms_snapshot' single-key blob.
//   5. L3 (SWR cache) needs no explicit prime: swrCacheUtils.loadStore()
//      lazily reads coldStartCacheStorage on first use, which is now backed
//      by our pre-populated map.
//   6. Always resolves globalColdStartHydrationReadyHandler in `finally`
//      so GlobalJotaiReady (web/desktop branch) can unblock React. The
//      resolved value is a `didHydrate` boolean for telemetry; the gate
//      releases regardless of value.
//
// Failure modes (all caught, all degrade to defaults):
//   • Dev (NODE_ENV !== 'production') — skip entirely to avoid schema drift
//   • Kill switch — localStorage.__cold_start_kill__ set
//   • Private mode / quota=0 — openIDB rejects
//   • Build hash mismatch — clear DB, fall back to defaults
//   • IDB stall — capped by HYDRATION_TIMEOUT_MS (300ms). On timeout we
//     set globalThis.__ONEKEY_COLD_START_TIMEOUT__ = true and unblock the
//     ready gate so React can still mount.
//
// Telemetry: globalThis.__ONEKEY_COLD_START_RESULT__ holds one of
//   'success' | 'timeout' | 'error' | 'killed' | 'skipped'
// describing the terminal state. 'success' means at least the L2 ctx
// snapshot was primed from IDB; everything else fell back to defaults
// ('skipped' is the deliberate dev-mode no-op).

/* eslint-disable no-console */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  flushColdStartCacheNow,
  primeColdStartCacheMap,
  readAllColdStartEntriesFromIdb,
  resetColdStartCache,
  writeColdStartMeta,
} from '@onekeyhq/shared/src/storage/instance/webColdStartStorage';
import { normalizeSwapColdStartCacheSnapshot } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';

import { globalColdStartHydrationReadyHandler } from '../states/jotai/coldStartReady';

import type { IColdStartHydrationStatus } from '../states/jotai/coldStartReady';

// ---- Constants ----

const META_KEY_PREFIX = '__meta:';
const CTX_SNAPSHOT_KEY = 'onekey_jotai_context_atoms_snapshot';
const BUILD_HASH_KEY = '__meta:buildHash';
const KILL_SWITCH_LS_KEY = '__cold_start_kill__';
const COLD_START_RESULT_GLOBAL = '__ONEKEY_COLD_START_RESULT__';
// Hard cap on how long we wait for IDB before giving up and degrading to
// defaults. The ready gate is awaited by GlobalJotaiReady on web/desktop,
// so an unbounded await here would block React mount on a stalled IDB.
const HYDRATION_TIMEOUT_MS = 300;
// Bound on how long we wait for the BUILD_HASH marker to flush before
// resolving the ready gate. Long enough to commit a single put() on a warm
// IDB connection, short enough that a wedged write cannot stall React mount.
const BUILD_HASH_FLUSH_TIMEOUT_MS = 1000;

// Schema-invalidation key for the cold-start cache. Sourced from the
// canonical commit SHA exposed via platformEnv (populated from GITHUB_SHA
// / WORKFLOW_GITHUB_SHA on CI). When the SHA changes between deploys, the
// cold-start IDB is wiped to prevent stale entries from a prior build
// leaking into a new code base. Local prod-mode builds without a CI env
// var will be undefined here; dev mode skips this path entirely.
//
// Precedence: `githubSHA` wins because it bumps on every commit; the
// version/buildNumber pair only changes on releases (coarser signal) but
// still beats disabling the gate entirely when CI env vars are absent.
export function computeEffectiveBuildHash(
  githubSHA: string | undefined,
  version: string | undefined,
  buildNumber: string | undefined,
): string | undefined {
  if (githubSHA) return githubSHA;
  if (version) return `v:${version}:${buildNumber ?? ''}`;
  return undefined;
}

const BUILD_HASH: string | undefined = computeEffectiveBuildHash(
  platformEnv.githubSHA || undefined,
  platformEnv.version || undefined,
  platformEnv.buildNumber || undefined,
);

// ---- Helpers ----

function setGlobal(name: string, value: unknown): void {
  (globalThis as Record<string, unknown>)[name] = value;
}

// Accepts the kill switch as a localStorage string. Off (false) when the
// key is unset, empty, '0', 'false', or 'no' (case-insensitive). Any other
// non-empty value flips it on. Avoids the `Boolean('0') === true` pitfall
// where `setItem(KILL_SWITCH_LS_KEY, '0')` would otherwise enable the kill
// switch.
function parseBooleanLike(v: string | null): boolean {
  if (v === null) return false;
  const trimmed = v.trim().toLowerCase();
  if (
    trimmed === '' ||
    trimmed === '0' ||
    trimmed === 'false' ||
    trimmed === 'no'
  ) {
    return false;
  }
  return true;
}

function readKillSwitch(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return parseBooleanLike(localStorage.getItem(KILL_SWITCH_LS_KEY));
  } catch {
    return false;
  }
}

function parseL2CtxSnapshot(
  entries: Map<string, unknown>,
): Record<string, unknown> {
  // L2 still goes through the ISyncStorage facade (set/setObject), which
  // JSON-stringifies on the way in. Keep the JSON.parse on read; if some
  // future caller starts writing this key raw, the typeof check degrades
  // to returning {} rather than throwing.
  const raw = entries.get(CTX_SNAPSHOT_KEY);
  if (typeof raw !== 'string' || !raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Race a promise against a timeout. On timeout, resolves with `undefined`
 * instead of throwing — callers detect the timeout by the undefined return
 * value and degrade to defaults.
 *
 * Pre-timeout rejection bubbles up so the outer try/catch records
 * __ONEKEY_COLD_START_ERROR__. Post-timeout settlement (resolve or reject)
 * is silently dropped so a late IDB error does not surface as an unhandled
 * promise rejection.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(undefined);
    }, ms);
    promise.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ---- Main ----

const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

// Telemetry tracked inside the IIFE and surfaced via __ONEKEY_COLD_START_RESULT__.
// `status` starts as 'error' so any path that throws before assigning falls into
// the error bucket; the success path overrides it explicitly.
let status: IColdStartHydrationStatus = 'error';
let didHydrate = false;

// Count entries excluding internal meta-keys. Used by the F6 invalidation
// path to distinguish a brand-new DB (no entries, no marker) from a legacy
// DB that predates the BUILD_HASH marker (real entries, no marker).
export function countNonMetaEntries(entries: Map<string, unknown>): number {
  let n = 0;
  for (const k of entries.keys()) {
    if (!k.startsWith(META_KEY_PREFIX)) n += 1;
  }
  return n;
}

/**
 * Decide whether the post-`resetColdStartCache` IDB recheck is clean enough
 * to proceed with priming + marker refresh.
 *
 * `resetColdStartCache` swallows `db.clear` failures (best-effort
 * semantics — see webColdStartStorage), so a successful await does NOT
 * guarantee the store is empty. If we naively trusted the return value and
 * wrote the new BUILD_HASH marker, the marker would match on the next boot
 * and we would prime stale entries written under a different schema. Worst-
 * case those entries deserialize into atom state and cause schema drift.
 *
 * Rules:
 *   • `undefined` (readAllColdStartEntriesFromIdb timed out / threw)
 *       → DO NOT proceed; cannot verify the wipe took.
 *   • Map containing only `__meta:*` keys
 *       → proceed; meta entries are non-payload and a meta-only DB is
 *         indistinguishable from a brand-new DB to downstream consumers.
 *   • Map containing any non-meta key
 *       → DO NOT proceed; the wipe left real entries behind.
 */
export function shouldProceedAfterReset(
  recheck: Map<string, unknown> | undefined,
): boolean {
  if (recheck === undefined) return false;
  return countNonMetaEntries(recheck) === 0;
}

const promise: Promise<void> = (async () => {
  // Skip in development to avoid schema drift between code changes.
  // Atoms will use defaults and jotaiInit will populate from JotaiStorage
  // as today. To test cold-start manually, build a production bundle.
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      '[ColdStartHydration] dev mode, skipping (cold-start is production-only)',
    );
    // Deliberate no-op: mark as 'skipped' so the finally block does not log
    // this as 'error' (the initial value). Keeps dev-mode skips distinct from
    // genuine IDB failures for any telemetry / debugging that inspects status.
    status = 'skipped';
    return;
  }

  if (readKillSwitch()) {
    // This branch is only reachable in production (the dev-mode early return
    // above guards it), and the unified finally block logs `status=killed`,
    // so no extra log is needed here.
    status = 'killed';
    return;
  }

  let entries: Map<string, unknown>;
  try {
    const result = await withTimeout(
      readAllColdStartEntriesFromIdb(),
      HYDRATION_TIMEOUT_MS,
    );
    if (result === undefined) {
      // Timed out — leave the in-memory map untouched (any early facade
      // writes from swrCacheUtils etc. stay) and bail. The empty
      // pre-hydration map degrades to defaults via jotaiInit.
      setGlobal('__ONEKEY_COLD_START_TIMEOUT__', true);
      status = 'timeout';
      return;
    }
    entries = result;
  } catch (e) {
    setGlobal('__ONEKEY_COLD_START_ERROR__', e);
    status = 'error';
    return;
  }

  // Detect deploy-time schema change. We invalidate on:
  //   (a) marker present but differs from the current BUILD_HASH, OR
  //   (b) marker absent but the DB has real (non-meta) entries — this is
  //       a legacy DB written before the marker existed, and we have no
  //       way to vouch for its schema, so treat it as a mismatch.
  //
  // The marker is the natural invalidation point for legacy DBs written by
  // the pre-structured-clone implementation (values were JSON-strings).
  // Because BUILD_HASH is sourced from the CI-injected commit SHA, any
  // deploy that flips the storage shape produces a new hash and triggers
  // the reset below on the next cold boot.
  if (BUILD_HASH !== undefined) {
    const storedHashRaw = entries.get(BUILD_HASH_KEY);
    const storedHash =
      typeof storedHashRaw === 'string' ? storedHashRaw : undefined;
    const isMismatch =
      (storedHash !== undefined && storedHash !== BUILD_HASH) ||
      (storedHash === undefined && countNonMetaEntries(entries) > 0);
    if (isMismatch) {
      try {
        await resetColdStartCache();
      } catch (e) {
        // Surface the wipe failure as a terminal error: stale entries (which
        // may include legacy L1 jotai/* keys from a prior build) MUST NOT
        // survive into the prime path, otherwise hydration could re-publish
        // values written under a different schema. Falling through with the
        // marker-write step would also fail against the same broken IDB.
        setGlobal('__ONEKEY_COLD_START_ERROR__', e);
        status = 'error';
        return;
      }
      // Recheck: resetColdStartCache swallows db.clear failures internally
      // (best-effort semantics), so a successful await does not prove IDB
      // is empty. If we trust the return value and write the new marker on
      // top of stale entries, the next boot's BUILD_HASH gate matches and
      // primes data written under a different schema. Re-read IDB and bail
      // out terminally if it still has non-meta entries.
      let recheck: Map<string, unknown> | undefined;
      try {
        recheck = await withTimeout(
          readAllColdStartEntriesFromIdb(),
          HYDRATION_TIMEOUT_MS,
        );
      } catch (e) {
        setGlobal('__ONEKEY_COLD_START_ERROR__', e);
        status = 'error';
        return;
      }
      if (!shouldProceedAfterReset(recheck)) {
        setGlobal(
          '__ONEKEY_COLD_START_ERROR__',
          new OneKeyLocalError('cold-start reset incomplete'),
        );
        status = 'error';
        return;
      }
      // Drop the stale entries; the freshly-written marker (below) is what
      // future cold starts will see. L1 mirror was removed, so there are no
      // in-flight mirror writes to replay across the reset.
      entries = new Map();
    }
  }

  // Synchronous-read backing store for swrCacheUtils + coldStartCacheStorage.
  primeColdStartCacheMap(entries);

  // Refresh the build-hash marker (first install: writes it for the first
  // time so future cold starts can detect mismatch). Force-flush eagerly,
  // bounded by BUILD_HASH_FLUSH_TIMEOUT_MS, so a closing tab cannot leave
  // the marker stuck in the in-memory dirty set — that would render the F6
  // invalidation gate permanently no-op for users who don't dwell.
  if (BUILD_HASH !== undefined && entries.get(BUILD_HASH_KEY) !== BUILD_HASH) {
    writeColdStartMeta(BUILD_HASH_KEY, BUILD_HASH);
    try {
      await withTimeout(flushColdStartCacheNow(), BUILD_HASH_FLUSH_TIMEOUT_MS);
    } catch {
      // flushColdStartCacheNow swallows its own errors; an unexpected throw
      // here must not block the ready signal.
    }
  }

  // L2: contextAtom snapshot consumed at hydrateContextColdStartCacheForProvider.
  // didHydrate is driven by this — it is the only layer whose presence affects
  // first paint now that L1 is removed. L3 hits the primed map lazily and has
  // no observable mount-time signal.
  const ctxSnapshot = normalizeSwapColdStartCacheSnapshot(
    parseL2CtxSnapshot(entries),
  );
  setGlobal('__ONEKEY_CTX_ATOM_SNAPSHOT__', ctxSnapshot);

  // L3: swrCacheUtils.loadStore() lazily reads coldStartCacheStorage on first
  // call → hits the primed map automatically. No explicit step needed here.

  status = 'success';
  didHydrate = Object.keys(ctxSnapshot).length > 0;
})()
  .catch((e: unknown) => {
    setGlobal('__ONEKEY_COLD_START_ERROR__', e);
    status = 'error';
    didHydrate = false;
  })
  .finally(() => {
    const t1 =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    setGlobal(COLD_START_RESULT_GLOBAL, status);
    globalColdStartHydrationReadyHandler.status = status;
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ColdStartHydration] ready in ${Math.round(t1 - t0)}ms`,
        `status=${status}`,
        `didHydrate=${didHydrate}`,
      );
    }
    // Pass didHydrate (telemetry); GlobalJotaiReady ignores the value and
    // always releases the gate so React mount is never blocked by a miss.
    globalColdStartHydrationReadyHandler.resolveReady(didHydrate);
  });

setGlobal('__ONEKEY_COLD_START_PROMISE__', promise);
