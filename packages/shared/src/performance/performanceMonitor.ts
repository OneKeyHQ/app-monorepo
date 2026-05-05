/**
 * Performance Monitoring - Main Entry
 *
 * This module provides the main entry point for initializing performance monitoring.
 * It should be called at the very beginning of the application, before other imports.
 *
 * Usage:
 *   import { initPerformanceMonitoring } from '@onekeyhq/shared/src/performance/performanceMonitor';
 *   await initPerformanceMonitoring({ platform: 'web' });
 *   // ... rest of the app imports
 */

import {
  startFPSCollection,
  stopFPSCollection,
} from './collectors/fpsCollector';
import {
  startJsBlockCollection,
  stopJsBlockCollection,
} from './collectors/jsBlockCollector';
import {
  startMemoryCollection,
  stopMemoryCollection,
} from './collectors/memoryCollector';
import { isPerfMonitorEnabled } from './enabled';
import { installFunctionHitLogger } from './functionHitLogger';
import { closePerfReporter, initPerfReporter } from './reporter';

import type { IPerfEvent } from './reporter/types';

export interface IPerformanceMonitoringOptions {
  platform: IPerfEvent['platform'];
  serverUrl?: string;
  timeout?: number;
  collectMemory?: boolean;
  collectFPS?: boolean;
  collectJSBlock?: boolean;
  memoryInterval?: number;
}

const DEFAULT_SERVER_PORT = 9527;
const DEFAULT_TIMEOUT = 3000;

/**
 * Get the default server URL based on platform
 * - Web/Desktop/Extension: localhost works fine
 * - iOS Simulator: localhost works fine
 * - Android Emulator: need to use 10.0.2.2 to reach host machine
 * - Physical devices: would need actual IP (not handled here)
 */
function getDefaultServerUrl(platform: IPerfEvent['platform']): string {
  if (platform === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    return `ws://10.0.2.2:${DEFAULT_SERVER_PORT}`;
  }
  return `ws://localhost:${DEFAULT_SERVER_PORT}`;
}

/**
 * Check if performance monitoring is enabled
 */
export function isPerfMonitoringEnabled(): boolean {
  return isPerfMonitorEnabled();
}

/**
 * Initialize performance monitoring
 *
 * This function:
 * 1. Connects to the performance server via WebSocket
 * 2. Installs global hooks for reporting
 * 3. Starts system metrics collection (memory, FPS)
 *
 * @param options Configuration options
 * @returns Promise that resolves to true if connected, false otherwise
 */
export async function initPerformanceMonitoring(
  options: IPerformanceMonitoringOptions,
): Promise<boolean> {
  if (!isPerfMonitoringEnabled()) {
    return false;
  }
  const {
    platform,
    serverUrl,
    timeout = DEFAULT_TIMEOUT,
    collectMemory = true,
    collectFPS = true,
    collectJSBlock = true,
    memoryInterval = 100,
  } = options;

  // Use platform-specific default URL if not provided
  const finalServerUrl = serverUrl ?? getDefaultServerUrl(platform);

  // eslint-disable-next-line no-console
  console.log(
    `[PerfMonitor] Initializing for platform: ${platform}, server: ${finalServerUrl}`,
  );

  if (collectJSBlock) {
    startJsBlockCollection();
  }

  const connected = await initPerfReporter({
    serverUrl: finalServerUrl,
    timeout,
    platform,
  });

  if (connected) {
    // Install function hit logger for Babel plugin hooks
    installFunctionHitLogger();

    // Start system metrics collection
    if (collectMemory) {
      startMemoryCollection(memoryInterval);
    }
    if (collectFPS) {
      startFPSCollection();
    }

    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] Ready, collecting metrics...');
  } else {
    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] Server not available, monitoring disabled');
    if (collectJSBlock) {
      stopJsBlockCollection();
    }
  }

  return connected;
}

/**
 * Stop performance monitoring
 */
export function stopPerformanceMonitoring() {
  stopMemoryCollection();
  stopFPSCollection();
  stopJsBlockCollection();
  closePerfReporter();
}

// Re-export types and utilities
export type { IPerfEvent } from './reporter/types';
export {
  initPerfReporter,
  getPerfReporter,
  closePerfReporter,
} from './reporter';
export {
  startMemoryCollection,
  stopMemoryCollection,
} from './collectors/memoryCollector';
export {
  startFPSCollection,
  stopFPSCollection,
} from './collectors/fpsCollector';
