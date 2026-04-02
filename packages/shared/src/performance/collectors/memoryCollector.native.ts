/**
 * Memory Collector (React Native)
 *
 * React Native doesn't expose JS heap metrics in a cross-platform way.
 * We use a small native module to read process memory and report it.
 */

import { ReactNativePerfMemory } from '@onekeyfe/react-native-perf-memory';

let intervalId: ReturnType<typeof setInterval> | null = null;
let isCollecting = false;

type IPerfMemoryUsage = {
  heapUsed?: number;
  heapTotal?: number;
  external?: number;
  rss?: number;
} | null;

type IMemoryCollectorGlobal = {
  __perfReportMemory?: (data: NonNullable<IPerfMemoryUsage>) => void;
};

export async function getMemoryUsage(): Promise<IPerfMemoryUsage> {
  const result = await ReactNativePerfMemory.getMemoryUsage();
  return { rss: result.rss };
}

async function collectOnce() {
  if (isCollecting) return;
  isCollecting = true;

  try {
    const memory = await getMemoryUsage();
    const g = globalThis as unknown as IMemoryCollectorGlobal;
    if (memory && typeof g.__perfReportMemory === 'function') {
      g.__perfReportMemory(memory);
    }
  } catch {
    // ignore
  } finally {
    isCollecting = false;
  }
}

/**
 * Start memory collection
 *
 * @param intervalMs Collection interval in milliseconds (default: 500)
 */
export function startMemoryCollection(intervalMs = 500) {
  if (intervalId) {
    return; // Already running
  }

  intervalId = setInterval(() => {
    void collectOnce();
  }, intervalMs);

  // Collect immediately
  void collectOnce();
}

/**
 * Stop memory collection
 */
export function stopMemoryCollection() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export default {
  startMemoryCollection,
  stopMemoryCollection,
  getMemoryUsage,
};
