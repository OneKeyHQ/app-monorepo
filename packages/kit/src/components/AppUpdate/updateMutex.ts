// JS-process-wide mutex for the foreground downloadPackage() entry point.
// Cold-launch useEffect, AppState 'active' listener, and user-driven button
// clicks can all enter `downloadPackage()` concurrently within the same JS
// tick. Without this mutex the second caller hits native's isDownloading
// guard with "Already downloading", which the in-flight retry layer treats
// as unrecoverable — flipping status to downloadPackageFailed mid-flow and
// stranding the original (still healthy) download. Returning the in-flight
// Promise to every concurrent caller collapses them into one logical
// attempt that all observers await together.
//
// Module-scoped is safe because JS is single-threaded; the assignment
// happens synchronously before any await suspension point, so a second
// caller in any subsequent task / microtask sees the in-flight Promise.

let inFlightDownloadPackage: Promise<void> | null = null;

/**
 * Returns the in-flight download Promise if one exists, otherwise null.
 * Callers should await the returned promise (matching the original
 * caller's outcome) instead of starting a second native download.
 */
export function getInFlightDownloadPackage(): Promise<void> | null {
  return inFlightDownloadPackage;
}

/**
 * Wraps `run` so that all concurrent callers share a single in-flight
 * Promise. The first caller starts `run()` and stores the returned
 * Promise (chained with a finalizer that clears the slot); subsequent
 * callers in the same JS tick see the stored Promise and await it
 * directly.
 */
export function withDownloadMutex(run: () => Promise<void>): Promise<void> {
  if (inFlightDownloadPackage) {
    return inFlightDownloadPackage;
  }
  inFlightDownloadPackage = run().finally(() => {
    inFlightDownloadPackage = null;
  });
  return inFlightDownloadPackage;
}

// Test-only: clears the slot between cases. Not exported from index.ts.
export function __resetDownloadMutexForTests() {
  inFlightDownloadPackage = null;
}
