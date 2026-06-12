/* cspell:ignore dedup */
/**
 * Production bundle loader (Phase 2)
 *
 * Installs `global.__loadBundleAsync` for production split bundle loading.
 * This replaces the Metro dev server's default async bundle loader.
 *
 * State machine per segment:
 *   idle → resolving → registering → ready
 *                   ↘ failed
 *
 * Features:
 * - Inflight dedup: concurrent requests for the same segment share one Promise
 * - dependsOn recursion with cycle detection
 * - Runtime-based segment access control (main-only / bg-only / shared)
 * - Failure caching (no auto-retry within process lifetime)
 * - Explicit retrySegment() for recovery/debugging
 */

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

import { getRuntimeKind } from './runtimeInfo';
import {
  getSegmentEntry,
  getSegmentManifest,
  isSegmentAllowedInRuntime,
} from './segmentManifest';

import type { ISegmentLoadState, ISplitBundleNativeLoader } from './types';

// Prefix reserved for keys produced by the split-bundle serializer.
// Anything NOT starting with this is a Metro default async-require
// identifier (e.g. `/packages/foo/index.bundle?modulesOnly=true`) for a
// module the serializer chose to keep in the eager bundle — in that case
// the module is already available synchronously and we should resolve
// without hitting the native loader.
const SEG_PREFIX = 'seg:';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const segmentStates = new Map<string, ISegmentLoadState>();
const loadedSegments = new Set<string>();
const failedSegments = new Map<string, Error>();
const inflightSegments = new Map<string, Promise<void>>();
// Module-level set tracking segments currently being resolved in any call chain.
// Used for cross-inflight cycle detection.
const globalLoading = new Set<string>();
// Tracks eager-fallback keys we've already warned about so we don't spam
// the log when the same async-require is invoked repeatedly.
const eagerFallbackWarned = new Set<string>();

// ---------------------------------------------------------------------------
// Retryable-vs-fatal native reject classification (H3)
// ---------------------------------------------------------------------------

// Native reject codes that indicate a TRANSIENT condition: the runtime/host
// simply wasn't ready yet (no runtime) or the buffered runtime executor never
// ran in time (timeout, e.g. a segment load requested before the entry bundle
// finished evaluating). For the first MAX_RETRYABLE_ATTEMPTS-1 attempts these
// are NOT cached as failures — so an early `import()` during startup/reload is
// re-attempted on the next call instead of poisoning the segment for the whole
// process. Only on the FINAL attempt does the circuit-breaker (see
// MAX_RETRYABLE_ATTEMPTS below) cache the failure to stop a permanently wedged
// runtime from re-attempting forever; `retrySegment()` clears that cache.
//
// This set is EXACTLY { SPLIT_BUNDLE_NO_RUNTIME, SPLIT_BUNDLE_TIMEOUT } and is
// shared verbatim with the Android loader. Every native producer emits DISTINCT
// per-cause reject codes, each mapped EXPLICITLY (no silent fall-through that
// could misclassify a fatal failure as retryable):
//   - iOS main runtime: SplitBundleLoader.mm maps its ESegmentEvalError codes
//     (incl. ivar-missing → fatal SPLIT_BUNDLE_NATIVE_UNAVAILABLE).
//   - iOS background runtime: BackgroundThread.loadSegmentInBackground maps the
//     manager's EBgMgrSegmentEvalError codes (fix 1) — a missing bg segment file
//     surfaces as fatal SPLIT_BUNDLE_NOT_FOUND, a renamed ivar as fatal
//     SPLIT_BUNDLE_NATIVE_UNAVAILABLE, and only not-started / nil-instance /
//     timeout are retryable.
//   - Android: its watchdog rejects with SPLIT_BUNDLE_TIMEOUT.
// A real bg EVAL/IO/NOT_FOUND/structural failure therefore surfaces as its own
// fatal code and is correctly NOT retried.
const RETRYABLE_NATIVE_REJECT_CODES = new Set<string>([
  'SPLIT_BUNDLE_NO_RUNTIME',
  'SPLIT_BUNDLE_TIMEOUT',
]);

// Fatal native reject codes are everything else (e.g. SPLIT_BUNDLE_EVAL_ERROR
// — a real bug in the segment's own JS; SPLIT_BUNDLE_IO_ERROR;
// SPLIT_BUNDLE_NATIVE_UNAVAILABLE — a native primitive was unavailable
// (Android-only producer); SPLIT_BUNDLE_SHA256_MISMATCH; SPLIT_BUNDLE_NOT_FOUND;
// SPLIT_BUNDLE_INVALID_PATH). These keep the existing cache-as-failed behavior:
// retrying just reproduces the same failure.

// Bounds the number of times a retryable reject re-attempts the SAME segment
// before we give up and cache it as a permanent failure. Without this cap a
// truly wedged runtime (one that keeps reporting NO_RUNTIME / TIMEOUT) would
// re-attempt on every `import()` forever. Reset to 0 once the segment loads
// successfully.
const MAX_RETRYABLE_ATTEMPTS = 3;
const retryableAttempts = new Map<string, number>();

/**
 * Read the native reject `code` from a thrown error. RN TurboModule rejections
 * (`reject(code, message, nsError)`) surface `code` as the JS Error's `.code`
 * string (see RCTJSErrorFromCodeMessageAndNSError). Returns undefined for our
 * own SegmentLoadError / non-native throws.
 */
function getNativeRejectCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Log a diagnostic without letting it propagate — used in the eager
 * fallback path, which must never fail the async require.
 */
function safeNativeLog(
  level: (typeof LogLevel)[keyof typeof LogLevel],
  message: string,
) {
  try {
    NativeLogger.write(level, message);
  } catch {
    /* intentionally silent: log must not break caller */
  }
}

let nativeLoader: ISplitBundleNativeLoader | null = null;

// ---------------------------------------------------------------------------
// Segment load stats (timing aggregation)
// ---------------------------------------------------------------------------

const segmentStats = {
  totalLoaded: 0,
  totalBytes: 0,
  totalTimeMs: 0,
  failures: 0,
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

class SegmentLoadError extends Error {
  // Native reject `code` that ultimately caused this failure (own or
  // propagated from a failing dependency). Preserved (fix C) so a PARENT
  // segment whose dep rejected can still read the underlying native code — the
  // raw RN TurboModule error carries `.code`, but once we wrap it in a
  // SegmentLoadError that `.code` is lost unless we copy it here.
  public code?: string;

  // Whether `code` is in the retryable set. Cached on the error so the parent's
  // failure handler can propagate retryable-ness WITHOUT re-deriving it (and
  // without needing the original native error object, which it never sees).
  public retryable: boolean;

  constructor(
    public segmentKey: string,
    message: string,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(`[SplitBundle] ${segmentKey}: ${message}`);
    this.name = 'SegmentLoadError';
    this.code = options?.code;
    this.retryable = options?.retryable ?? false;
  }
}

// ---------------------------------------------------------------------------
// Core loader
// ---------------------------------------------------------------------------

function ensureNativeLoader(): ISplitBundleNativeLoader {
  if (!nativeLoader) {
    throw new SegmentLoadError(
      '*',
      'Native SplitBundleLoader not initialized. Call setNativeLoader() first.',
    );
  }
  return nativeLoader;
}

async function loadSegmentInternal(segmentKey: string): Promise<void> {
  // Already loaded
  if (loadedSegments.has(segmentKey)) {
    return;
  }

  // Already failed — reject immediately
  const prevError = failedSegments.get(segmentKey);
  if (prevError) {
    NativeLogger.write(
      LogLevel.Error,
      `[SplitBundle] ${segmentKey}: previously failed: ${prevError.message}`,
    );
    throw prevError;
  }

  // Inflight dedup
  const inflight = inflightSegments.get(segmentKey);
  if (inflight) {
    return inflight;
  }

  // Cycle detection: uses module-level set so all concurrent call chains
  // share visibility into what's currently being resolved.
  if (globalLoading.has(segmentKey)) {
    throw new SegmentLoadError(
      segmentKey,
      `Circular dependency detected: ${segmentKey} is already being loaded`,
    );
  }

  const promise = (async () => {
    globalLoading.add(segmentKey);
    try {
      // Lookup manifest
      const entry = getSegmentEntry(segmentKey);
      if (!entry) {
        // Prefix-based routing so we can tell a real miss apart from an
        // eager fallback. `seg:xxx` identifiers are emitted by our
        // serializer — if one of those is missing, the manifest is broken
        // and callers must see a hard error. Any other identifier comes
        // from Metro's default async require template for a module we
        // chose to keep in the eager bundle; the module is already
        // available synchronously and we short-circuit.
        if (segmentKey.startsWith(SEG_PREFIX)) {
          throw new SegmentLoadError(
            segmentKey,
            `segment missing from manifest (runtime=${getRuntimeKind()}, manifestSize=${
              Object.keys(getSegmentManifest().segments).length
            })`,
          );
        }

        // Pure eager-fallback: mark ready first, diagnostic log strictly
        // after — so a logger failure can never turn a success into an
        // error. Warn once per unique key.
        // NOTE: Metro async-require URL shape is matched in three places:
        //   - apps/mobile/plugins/segmentSerializer.rewriteAsyncPaths.js
        //     (build-time rewrite)
        //   - apps/mobile/scripts/check-split-bundle-integrity.js
        //     UNREWRITTEN_ASYNC_PATH (build-time CI gate)
        //   - here (runtime telemetry — distinguishes a corrupted bundle
        //     from legitimate eager fallback)
        // If Metro changes the URL shape, all three must be updated in
        // lockstep.
        const isMetroAsyncRequireUrl =
          /\.bundle\?modulesOnly=true&runModule=false/.test(segmentKey);
        loadedSegments.add(segmentKey);
        segmentStates.set(segmentKey, 'ready');
        if (!eagerFallbackWarned.has(segmentKey)) {
          eagerFallbackWarned.add(segmentKey);
          if (isMetroAsyncRequireUrl) {
            // The serializer was supposed to rewrite this to `seg:<key>`.
            // It didn't, so the require() that follows will FATAL.  Log
            // loud and structured so we can diagnose a corrupted OTA
            // bundle from production logs. See REACT-NATIVE-4AX, and the
            // build-time integrity check at
            // apps/mobile/scripts/check-split-bundle-integrity.js which
            // should have caught this before the bundle shipped.
            safeNativeLog(
              LogLevel.Error,
              `[SplitBundle][BUG] missing-rewrite eager fallback: key="${segmentKey}" runtime=${getRuntimeKind()}`,
            );
          } else {
            safeNativeLog(
              LogLevel.Warning,
              `[SplitBundle] eager fallback: key="${segmentKey}" runtime=${getRuntimeKind()}`,
            );
          }
        }
        return;
      }

      // Runtime access control
      const currentRuntime = getRuntimeKind();
      if (!isSegmentAllowedInRuntime(entry.runtime, currentRuntime)) {
        throw new SegmentLoadError(
          segmentKey,
          `Segment runtime '${entry.runtime}' not allowed in '${currentRuntime}' runtime`,
        );
      }

      segmentStates.set(segmentKey, 'resolving');

      // Recursively load dependencies first.
      //
      // Shared segments whose two runtimes' segment-level deps diverge ship
      // per-runtime override lists; without this, a main-only dep would
      // throw "runtime not allowed" inside the bg runtime (and vice versa)
      // when the merged manifest is consulted. Fall back to `dependsOn` when
      // overrides aren't present (entries with identical deps across
      // runtimes, or non-shared entries).
      const runtimeDeps =
        (currentRuntime === 'main' && entry.mainDependsOn) ||
        (currentRuntime === 'background' && entry.backgroundDependsOn) ||
        entry.dependsOn;
      if (runtimeDeps.length > 0) {
        for (const dep of runtimeDeps) {
          await loadSegmentInternal(dep);
        }
      }

      // Register with native
      segmentStates.set(segmentKey, 'registering');
      const loader = ensureNativeLoader();

      const startMs = Date.now();
      await loader.loadSegment({
        segmentId: entry.id,
        segmentKey: entry.key,
        relativePath: entry.relativePath,
        sha256: entry.sha256,
      });
      const durationMs = Date.now() - startMs;

      segmentStats.totalLoaded += 1;
      segmentStats.totalTimeMs += durationMs;

      // ONEKEY_STARTUP_PROFILE: emit per-segment breakdown.
      // NOTE: The combined duration above covers native I/O (open+read+mmap)
      // + Hermes bytecode parse + register. Splitting I/O vs parse would
      // require a patch to @onekeyfe/react-native-split-bundle-loader; for
      // now we emit total + size so the slowest segments are identifiable.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if ((globalThis as any).__ONEKEY_STARTUP_PROFILE__ === true) {
        NativeLogger.write(
          LogLevel.Info,
          `[StartupProfile.seg] ${durationMs}ms id=${entry.id} key=${entry.key} path=${entry.relativePath}`,
        );
      }

      defaultLogger.app.bootstrap.initDeferredStep(
        `segment:${segmentKey}`,
        durationMs,
      );

      segmentStates.set(segmentKey, 'ready');
      loadedSegments.add(segmentKey);
    } finally {
      globalLoading.delete(segmentKey);
    }
  })();

  inflightSegments.set(segmentKey, promise);

  try {
    await promise;
    // Success clears any retry bookkeeping for this segment.
    retryableAttempts.delete(segmentKey);
  } catch (error) {
    segmentStats.failures += 1;
    segmentStates.set(segmentKey, 'failed');

    // Classify retryable-ness from EITHER source (fix C):
    //   (a) a DIRECT native reject — the raw RN TurboModule error carries
    //       `.code`; map it against the retryable set; or
    //   (b) a PROPAGATED dep failure — `loadSegmentInternal(dep)` already
    //       wrapped its native error in a SegmentLoadError that lost the raw
    //       `.code`, but it copied the native `code` + `retryable` flag onto
    //       the SegmentLoadError. Without this branch the parent would see a
    //       codeless SegmentLoadError, treat the failure as fatal, and write
    //       ITSELF into failedSegments permanently — poisoning the parent even
    //       though the dep failure was a transient runtime-not-ready / timeout
    //       that should clear on retry.
    let nativeCode: string | undefined;
    let isRetryable: boolean;
    if (error instanceof SegmentLoadError) {
      nativeCode = error.code;
      isRetryable = error.retryable;
    } else {
      nativeCode = getNativeRejectCode(error);
      isRetryable =
        nativeCode !== undefined &&
        RETRYABLE_NATIVE_REJECT_CODES.has(nativeCode);
    }

    // Wrap (or reuse) as a SegmentLoadError, threading the resolved
    // code/retryable through so THIS segment's parent (if it is itself a dep)
    // can propagate the same classification one level up.
    const segError =
      error instanceof SegmentLoadError
        ? error
        : new SegmentLoadError(
            segmentKey,
            error instanceof Error ? error.message : String(error),
            { code: nativeCode, retryable: isRetryable },
          );

    const attempts = (retryableAttempts.get(segmentKey) ?? 0) + 1;

    if (isRetryable && attempts < MAX_RETRYABLE_ATTEMPTS) {
      // Skip failedSegments so the NEXT __loadBundleAsync re-attempts (rather
      // than throwing the cached failure forever). State is reset to 'idle' and
      // the attempt counter bumped so a wedged runtime can't loop unbounded.
      retryableAttempts.set(segmentKey, attempts);
      segmentStates.set(segmentKey, 'idle');
      NativeLogger.write(
        LogLevel.Warning,
        `[SplitBundle] SEGMENT LOAD FAILED (retryable, attempt ${attempts}/${MAX_RETRYABLE_ATTEMPTS}, code=${nativeCode}); NOT caching as permanent — next load will re-attempt: ${segError.message}`,
      );
      throw segError;
    }

    // Non-retryable, or retryable budget exhausted → cache as permanent failure
    // (existing behavior). Only retrySegment() clears it from here.
    retryableAttempts.delete(segmentKey);
    failedSegments.set(segmentKey, segError);
    NativeLogger.write(
      LogLevel.Error,
      `[SplitBundle] SEGMENT LOAD FAILED${
        isRetryable ? ' (retryable budget exhausted)' : ''
      }${nativeCode ? ` code=${nativeCode}` : ''}: ${segError.message}`,
    );
    throw segError;
  } finally {
    inflightSegments.delete(segmentKey);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the native loader bridge. Must be called before any segment loads.
 */
export function setNativeLoader(loader: ISplitBundleNativeLoader): void {
  nativeLoader = loader;
}

/**
 * Load a segment by its key. Called by the global `__loadBundleAsync`.
 */
export async function loadSegment(segmentKey: string): Promise<void> {
  return loadSegmentInternal(segmentKey);
}

type IRuntimeBundlePathRecord = Partial<
  Record<'main' | 'background' | 'shared', string | null>
>;

type IBundlePathRequest = string | IRuntimeBundlePathRecord;

function resolveBundlePathRequest(request: IBundlePathRequest): string | null {
  if (typeof request === 'string') {
    return request;
  }

  const currentRuntime = getRuntimeKind();
  const hasRuntimeValue = currentRuntime in request;
  const resolved = hasRuntimeValue ? request[currentRuntime] : request.shared;

  if (resolved === undefined) {
    // Module is not available in this runtime (e.g., main-only module
    // accessed from background runtime via shared common bundle code).
    // Return null to skip loading — the subsequent require() will fail
    // gracefully via React error boundary instead of crashing the process.
    safeNativeLog(
      LogLevel.Warning,
      `[SplitBundle] No async bundle path for runtime '${currentRuntime}', available: [${Object.keys(request).join(', ')}]`,
    );
    return null;
  }

  return resolved;
}

async function loadBundleRequest(request: IBundlePathRequest): Promise<void> {
  const resolved = resolveBundlePathRequest(request);
  if (resolved === null) {
    return;
  }
  return loadSegmentInternal(resolved);
}

/**
 * Retry a previously failed segment. Clears the failure cache first.
 * Intended for debugging and recovery logic, not normal business flow.
 */
export async function retrySegment(segmentKey: string): Promise<void> {
  failedSegments.delete(segmentKey);
  segmentStates.delete(segmentKey);
  retryableAttempts.delete(segmentKey);
  return loadSegmentInternal(segmentKey);
}

/**
 * Query the current load state of a segment.
 */
export function getSegmentState(segmentKey: string): ISegmentLoadState {
  return segmentStates.get(segmentKey) || 'idle';
}

/**
 * Returns true if the segment has been successfully loaded.
 */
export function isSegmentLoaded(segmentKey: string): boolean {
  return loadedSegments.has(segmentKey);
}

/**
 * Returns aggregated segment load statistics for diagnostics.
 */
export function getSegmentLoadStats() {
  return { ...segmentStats };
}

/**
 * Keys that were satisfied by the eager-fallback path (no matching segment
 * in the manifest — module assumed to live in the main/common bundle).
 * Exposed for health checks / diagnostics.
 */
export function getEagerFallbackKeys(): string[] {
  return Array.from(eagerFallbackWarned);
}

// ---------------------------------------------------------------------------
// Install global __loadBundleAsync
// ---------------------------------------------------------------------------

type ILoadBundleAsyncGlobal = typeof globalThis & {
  __METRO_GLOBAL_PREFIX__?: string;
  __loadBundleAsync?: (bundlePath: IBundlePathRequest) => Promise<void>;
};

type IBundleLoaderFn = (bundlePath: IBundlePathRequest) => Promise<void>;

const loadBundleGlobalOverrides = new Map<
  string,
  {
    current: IBundleLoaderFn;
    wrapper: IBundleLoaderFn;
  }
>();

function getLoadBundleAsyncGlobalKeys(
  globalRef: ILoadBundleAsyncGlobal,
): string[] {
  const keys = new Set<string>(['__loadBundleAsync']);
  const metroPrefix = globalRef.__METRO_GLOBAL_PREFIX__;
  if (metroPrefix) {
    keys.add(`${metroPrefix}__loadBundleAsync`);
  }
  return Array.from(keys);
}

function installLoadBundleAsyncOverride(
  globalRef: ILoadBundleAsyncGlobal,
  loader: IBundleLoaderFn,
) {
  for (const key of getLoadBundleAsyncGlobalKeys(globalRef)) {
    const existing = loadBundleGlobalOverrides.get(key);
    if (existing) {
      existing.current = loader;
    } else {
      const state = {
        current: loader,
        wrapper: (bundlePath: IBundlePathRequest) => state.current(bundlePath),
      };
      loadBundleGlobalOverrides.set(key, state);

      Object.defineProperty(globalRef, key, {
        configurable: true,
        enumerable: false,
        get() {
          return state.wrapper;
        },
        set(_nextLoader: unknown) {
          // Expo async-require installs its own URL loader on first require().
          // Keep our segment loader authoritative in production split-bundle
          // mode by silently discarding every write — including self-assignment
          // of `state.wrapper`. The previous implementation allowed
          // `nextLoader === state.wrapper` through and set
          // `state.current = state.wrapper`, which turned `state.wrapper`
          // into an infinite self-reference and crashed with a stack
          // overflow on the next invocation.
        },
      });
    }
  }
}

/**
 * Install the production `__loadBundleAsync` handler.
 * Metro's `asyncRequire` calls `global.__loadBundleAsync(path)` for async
 * dependencies. In production, `path` is a segment key (e.g. "seg:feature.shared.wallet")
 * injected by our custom serializer.
 *
 * Must be called early in the entry point, BEFORE any async imports execute.
 *
 * Also arms the startup health probe — imported lazily to keep the hot
 * path free of a diagnostics-only dependency.
 */
export function installProdBundleLoader(
  loader: ISplitBundleNativeLoader,
): void {
  setNativeLoader(loader);
  installLoadBundleAsyncOverride(
    globalThis as ILoadBundleAsyncGlobal,
    loadBundleRequest,
  );
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const healthCheckModule = require('./healthCheck') as {
      scheduleSplitBundleHealthCheck: () => void;
    };
    healthCheckModule.scheduleSplitBundleHealthCheck();
  } catch {
    /* health check is best-effort — must not block loader install */
  }
}
