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

import { getRuntimeKind } from './runtimeInfo';
import { getSegmentEntry, isSegmentAllowedInRuntime } from './segmentManifest';

import type { ISplitBundleNativeLoader, SegmentLoadState } from './types';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const segmentStates = new Map<string, SegmentLoadState>();
const loadedSegments = new Set<string>();
const failedSegments = new Map<string, Error>();
const inflightSegments = new Map<string, Promise<void>>();
// Module-level set tracking segments currently being resolved in any call chain.
// Used for cross-inflight cycle detection.
const globalLoading = new Set<string>();

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
  constructor(
    public segmentKey: string,
    message: string,
  ) {
    super(`[SplitBundle] ${segmentKey}: ${message}`);
    this.name = 'SegmentLoadError';
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
        throw new SegmentLoadError(segmentKey, 'Segment not found in manifest');
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

      // Recursively load dependencies first
      if (entry.dependsOn.length > 0) {
        for (const dep of entry.dependsOn) {
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
      // eslint-disable-next-line no-console
      console.log(
        `[SplitBundle] segment ${segmentKey} loaded in ${durationMs}ms`,
      );

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
  } catch (error) {
    const segError =
      error instanceof SegmentLoadError
        ? error
        : new SegmentLoadError(
            segmentKey,
            error instanceof Error ? error.message : String(error),
          );
    segmentStats.failures += 1;
    segmentStates.set(segmentKey, 'failed');
    failedSegments.set(segmentKey, segError);
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

type RuntimeBundlePathRecord = Partial<
  Record<'main' | 'background' | 'shared', string | null>
>;

type BundlePathRequest = string | RuntimeBundlePathRecord;

function resolveBundlePathRequest(request: BundlePathRequest): string | null {
  if (typeof request === 'string') {
    return request;
  }

  const currentRuntime = getRuntimeKind();
  const hasRuntimeValue = currentRuntime in request;
  const resolved = hasRuntimeValue ? request[currentRuntime] : request.shared;

  if (resolved === undefined) {
    throw new SegmentLoadError(
      '*',
      `No async bundle path for runtime '${currentRuntime}'`,
    );
  }

  return resolved;
}

async function loadBundleRequest(request: BundlePathRequest): Promise<void> {
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
  return loadSegmentInternal(segmentKey);
}

/**
 * Query the current load state of a segment.
 */
export function getSegmentState(segmentKey: string): SegmentLoadState {
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

// ---------------------------------------------------------------------------
// Install global __loadBundleAsync
// ---------------------------------------------------------------------------

type LoadBundleAsyncGlobal = typeof globalThis & {
  __METRO_GLOBAL_PREFIX__?: string;
  __loadBundleAsync?: (bundlePath: BundlePathRequest) => Promise<void>;
};

type BundleLoaderFn = (bundlePath: BundlePathRequest) => Promise<void>;

const loadBundleGlobalOverrides = new Map<
  string,
  {
    current: BundleLoaderFn;
    wrapper: BundleLoaderFn;
  }
>();

function getLoadBundleAsyncGlobalKeys(
  globalRef: LoadBundleAsyncGlobal,
): string[] {
  const keys = new Set<string>(['__loadBundleAsync']);
  const metroPrefix = globalRef.__METRO_GLOBAL_PREFIX__;
  if (metroPrefix) {
    keys.add(`${metroPrefix}__loadBundleAsync`);
  }
  return Array.from(keys);
}

function installLoadBundleAsyncOverride(
  globalRef: LoadBundleAsyncGlobal,
  loader: BundleLoaderFn,
) {
  for (const key of getLoadBundleAsyncGlobalKeys(globalRef)) {
    const existing = loadBundleGlobalOverrides.get(key);
    if (existing) {
      existing.current = loader;
      continue;
    }

    const state = {
      current: loader,
      wrapper: (bundlePath: BundlePathRequest) => state.current(bundlePath),
    };
    loadBundleGlobalOverrides.set(key, state);

    Object.defineProperty(globalRef, key, {
      configurable: true,
      enumerable: false,
      get() {
        return state.wrapper;
      },
      set(nextLoader: unknown) {
        // Expo async-require installs its own URL loader on first require().
        // Keep our segment loader authoritative in production split-bundle mode.
        if (typeof nextLoader === 'function' && nextLoader === state.wrapper) {
          state.current = nextLoader as BundleLoaderFn;
        }
      },
    });
  }
}

/**
 * Install the production `__loadBundleAsync` handler.
 * Metro's `asyncRequire` calls `global.__loadBundleAsync(path)` for async
 * dependencies. In production, `path` is a segment key (e.g. "seg:feature.shared.wallet")
 * injected by our custom serializer.
 *
 * Must be called early in the entry point, BEFORE any async imports execute.
 */
export function installProdBundleLoader(
  loader: ISplitBundleNativeLoader,
): void {
  setNativeLoader(loader);
  installLoadBundleAsyncOverride(
    globalThis as LoadBundleAsyncGlobal,
    loadBundleRequest,
  );
}
