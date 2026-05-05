/**
 * Memory Collector
 *
 * Collects memory usage metrics and reports to the performance server.
 * Platform-specific implementations handle the actual memory reading.
 */

let intervalId: ReturnType<typeof setInterval> | null = null;
let isCollecting = false;

type IPerfMemoryUsage = {
  heapUsed?: number;
  heapTotal?: number;
  external?: number;
  rss?: number;
} | null;

type IDesktopSystemApi = {
  getPerfMemoryUsage?: () => Promise<IPerfMemoryUsage>;
};

type IMemoryCollectorGlobal = {
  desktopApiProxy?: {
    system?: IDesktopSystemApi;
  };
  __perfReportMemory?: (data: NonNullable<IPerfMemoryUsage>) => void;
};

/**
 * Get memory usage (platform-specific)
 */
function getMemoryUsageSync(): IPerfMemoryUsage {
  // Node.js / Electron (main/renderer)
  // Note: In Electron renderer, `performance.memory` can be present but may be
  // inaccurate or not updating, so prefer `process.memoryUsage()` when available.
  if (
    typeof process !== 'undefined' &&
    typeof process.memoryUsage === 'function'
  ) {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };
  }

  // Web: performance.memory (Chrome only)
  const performanceWithMemory = performance as unknown as {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
  };
  if (typeof performance !== 'undefined' && performanceWithMemory.memory) {
    const mem = performanceWithMemory.memory;
    return {
      heapUsed: mem.usedJSHeapSize,
      heapTotal: mem.totalJSHeapSize,
    };
  }

  // React Native: Would need native module
  // For now, return null (no data available)
  return null;
}

async function getDesktopMemoryUsageViaProxy(): Promise<IPerfMemoryUsage> {
  const g = globalThis as unknown as IMemoryCollectorGlobal;
  const systemApi = g.desktopApiProxy?.system;
  if (systemApi && typeof systemApi.getPerfMemoryUsage === 'function') {
    try {
      return await systemApi.getPerfMemoryUsage();
    } catch {
      return null;
    }
  }
  return null;
}

async function collectOnce() {
  if (isCollecting) return;
  isCollecting = true;

  try {
    const g = globalThis as unknown as IMemoryCollectorGlobal;

    const sync = getMemoryUsageSync();
    const desktop = await getDesktopMemoryUsageViaProxy();

    const desktopRss =
      desktop && typeof desktop.rss === 'number' ? desktop.rss : undefined;

    const syncHasProcessMemoryInfo =
      !!sync &&
      (typeof sync.rss === 'number' || typeof sync.external === 'number');

    const syncHeapLooksBogus =
      !!sync &&
      typeof sync.heapUsed === 'number' &&
      typeof sync.heapTotal === 'number' &&
      sync.heapUsed === sync.heapTotal;

    let memory: IPerfMemoryUsage = null;
    if (typeof desktopRss === 'number') {
      if (syncHasProcessMemoryInfo) {
        memory = { ...sync, rss: desktopRss };
      } else if (syncHeapLooksBogus) {
        memory = { rss: desktopRss };
      } else if (sync) {
        memory = { ...sync, rss: desktopRss };
      } else {
        memory = { rss: desktopRss };
      }
    } else {
      memory = sync;
    }

    if (memory && typeof g.__perfReportMemory === 'function') {
      g.__perfReportMemory(memory);
    }
  } finally {
    isCollecting = false;
  }
}

/**
 * Start memory collection
 *
 * @param intervalMs Collection interval in milliseconds (default: 100)
 */
export function startMemoryCollection(intervalMs = 100) {
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
  getMemoryUsage: getMemoryUsageSync,
};
