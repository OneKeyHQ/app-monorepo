/**
 * Split-bundle runtime health check.
 *
 * Runs once shortly after the loader is installed and emits a
 * `[SplitBundleHealth]` diagnostic line with enough context to
 * retro-diagnose any async-require mis-routing in production:
 *   - active runtime kind
 *   - segment manifest size
 *   - segments already loaded by the time the probe runs
 *   - eager-fallback keys observed so far
 *
 * Also flags structural issues (empty manifest, unknown runtime)
 * so they surface loudly on startup instead of silently eating a
 * later async require.
 */

import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

import {
  getEagerFallbackKeys,
  isSegmentLoaded,
} from './installProdBundleLoader';
import { getRuntimeKind } from './runtimeInfo';
import { getSegmentCount, getSegmentManifest } from './segmentManifest';

export type ISplitBundleHealthReport = {
  ok: boolean;
  runtime: string;
  manifestSize: number;
  loadedCount: number;
  eagerFallbackCount: number;
  eagerFallbackSample: string[];
  issues: string[];
};

const EAGER_FALLBACK_SAMPLE_LIMIT = 5;

function safeNativeLog(
  level: (typeof LogLevel)[keyof typeof LogLevel],
  message: string,
) {
  try {
    NativeLogger.write(level, message);
  } catch {
    /* intentionally silent — diagnostics must not crash startup */
  }
}

function countLoadedSegments(segmentKeys: string[]): number {
  let count = 0;
  for (const key of segmentKeys) {
    if (isSegmentLoaded(key)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Build a structured snapshot of split-bundle state. Pure; does not log.
 * Exported so tests (and future telemetry) can assert against the report
 * without scraping log output.
 */
export function buildSplitBundleHealthReport(): ISplitBundleHealthReport {
  const issues: string[] = [];

  let runtime = 'unknown';
  try {
    runtime = getRuntimeKind();
  } catch (error) {
    issues.push(
      `getRuntimeKind threw: ${(error as Error)?.message ?? String(error)}`,
    );
  }
  if (runtime !== 'main' && runtime !== 'background') {
    issues.push(`unexpected runtime kind "${runtime}"`);
  }

  let manifestSize = 0;
  let segmentKeys: string[] = [];
  try {
    manifestSize = getSegmentCount();
    segmentKeys = Object.keys(getSegmentManifest().segments);
  } catch (error) {
    issues.push(
      `manifest access threw: ${(error as Error)?.message ?? String(error)}`,
    );
  }
  if (manifestSize === 0) {
    issues.push('segment manifest is empty');
  }

  const loadedCount = countLoadedSegments(segmentKeys);

  let eagerFallbackKeys: string[] = [];
  try {
    eagerFallbackKeys = getEagerFallbackKeys();
  } catch (error) {
    issues.push(
      `getEagerFallbackKeys threw: ${(error as Error)?.message ?? String(error)}`,
    );
  }

  return {
    ok: issues.length === 0,
    runtime,
    manifestSize,
    loadedCount,
    eagerFallbackCount: eagerFallbackKeys.length,
    eagerFallbackSample: eagerFallbackKeys.slice(
      0,
      EAGER_FALLBACK_SAMPLE_LIMIT,
    ),
    issues,
  };
}

/**
 * Write the health report to the native file log. Safe to call during
 * startup — never throws, never rejects.
 */
export function reportSplitBundleHealth(): ISplitBundleHealthReport {
  const report = buildSplitBundleHealthReport();
  const level = report.ok ? LogLevel.Info : LogLevel.Error;
  const parts = [
    `runtime=${report.runtime}`,
    `manifestSize=${report.manifestSize}`,
    `loadedCount=${report.loadedCount}`,
    `eagerFallback=${report.eagerFallbackCount}`,
  ];
  if (report.eagerFallbackSample.length > 0) {
    parts.push(
      `eagerSample=[${report.eagerFallbackSample.map((k) => `"${k}"`).join(',')}]`,
    );
  }
  if (report.issues.length > 0) {
    parts.push(`issues=[${report.issues.map((i) => `"${i}"`).join(',')}]`);
  }
  safeNativeLog(level, `[SplitBundleHealth] ${parts.join(' ')}`);
  return report;
}

const HEALTH_CHECK_DELAY_MS = 2000;

let scheduled = false;

/**
 * Schedule a single health-check emission shortly after startup.
 * Subsequent calls are no-ops within the same process.
 */
export function scheduleSplitBundleHealthCheck(): void {
  if (scheduled) {
    return;
  }
  scheduled = true;
  setTimeout(() => {
    try {
      reportSplitBundleHealth();
    } catch {
      /* health check must never crash the app */
    }
  }, HEALTH_CHECK_DELAY_MS);
}

// Exposed purely for tests — resets the "already scheduled" latch.
export function __resetSplitBundleHealthCheckForTests(): void {
  scheduled = false;
}
