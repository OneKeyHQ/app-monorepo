/**
 * Performance Monitoring Bootstrap
 *
 * This module provides a bootstrapping utility that initializes performance monitoring
 * before the main application starts. It ensures WebSocket connection is established
 * (or times out) before proceeding.
 *
 * Usage in entry files:
 *
 *   // Option 1: Using bootstrap function
 *   import { bootstrapWithPerfMonitoring } from '@onekeyhq/shared/src/performance/bootstrap';
 *   bootstrapWithPerfMonitoring({
 *     platform: 'web',
 *     onReady: () => require('./App'),
 *   });
 *
 *   // Option 2: Using async/await
 *   import { initPerformanceMonitoring, isPerfMonitoringEnabled } from '@onekeyhq/shared/src/performance/performanceMonitor';
 *   if (isPerfMonitoringEnabled()) {
 *     await initPerformanceMonitoring({ platform: 'web' });
 *   }
 *   require('./App');
 */

import {
  initPerformanceMonitoring,
  isPerfMonitoringEnabled,
} from './performanceMonitor';

import type { IPerformanceMonitoringOptions } from './performanceMonitor';

export interface IBootstrapOptions extends Partial<IPerformanceMonitoringOptions> {
  platform: IPerformanceMonitoringOptions['platform'];
  onReady: () => void;
  /**
   * Force enable/disable performance monitoring.
   * If not specified, uses isPerfMonitoringEnabled() to check environment.
   */
  enabled?: boolean;
  /**
   * If true, call onReady() immediately and connect to perf server in background.
   * This is required for React Native where AppRegistry.registerComponent must be synchronous.
   * Default: true for mobile platforms (ios/android), false for others.
   */
  nonBlocking?: boolean;
}

/**
 * Bootstrap the application with performance monitoring.
 *
 * If performance monitoring is enabled, this function will:
 * 1. Initialize WebSocket connection to performance server
 * 2. Wait for connection (or timeout)
 * 3. Call onReady() to start the application
 *
 * If performance monitoring is disabled, onReady() is called immediately.
 *
 * @param options Bootstrap options
 */
export function bootstrapWithPerfMonitoring(options: IBootstrapOptions) {
  const { platform, onReady, enabled, nonBlocking, ...monitoringOptions } =
    options;

  // eslint-disable-next-line no-console
  console.log('[Bootstrap] bootstrapWithPerfMonitoring called with:', {
    platform,
    enabled,
    nonBlocking,
    monitoringOptions,
  });

  // eslint-disable-next-line no-console
  console.log('[Bootstrap] Checking isPerfMonitoringEnabled...');
  const isPerfEnabled = isPerfMonitoringEnabled();
  // eslint-disable-next-line no-console
  console.log('[Bootstrap] isPerfMonitoringEnabled() returned:', isPerfEnabled);

  const shouldEnable = enabled ?? isPerfEnabled;
  // eslint-disable-next-line no-console
  console.log(
    '[Bootstrap] Final shouldEnable:',
    shouldEnable,
    '(enabled param was:',
    enabled,
    ')',
  );

  if (!shouldEnable) {
    // Performance monitoring disabled, start app immediately
    // eslint-disable-next-line no-console
    console.log(
      '[Bootstrap] Performance monitoring DISABLED, starting app immediately',
    );
    onReady();
    return;
  }

  // Determine if we should use non-blocking mode
  // Default to non-blocking for mobile platforms (ios/android) since React Native
  // requires AppRegistry.registerComponent to be called synchronously
  const isMobilePlatform = platform === 'ios' || platform === 'android';
  const useNonBlocking = nonBlocking ?? isMobilePlatform;

  // eslint-disable-next-line no-console
  console.log('[Bootstrap] Performance monitoring ENABLED, connecting...', {
    isMobilePlatform,
    useNonBlocking,
  });

  if (useNonBlocking) {
    // Non-blocking mode: Start app immediately, connect in background
    // This is required for React Native where AppRegistry.registerComponent must be synchronous
    // eslint-disable-next-line no-console
    console.log(
      '[Bootstrap] Non-blocking mode: starting app first, connecting in background...',
    );
    onReady();

    // Connect in background
    void initPerformanceMonitoring({
      platform,
      ...monitoringOptions,
    }).then((connected) => {
      if (connected) {
        // eslint-disable-next-line no-console
        console.log('[Bootstrap] Background connection successful');
      } else {
        // eslint-disable-next-line no-console
        console.log('[Bootstrap] Background connection failed or timed out');
      }
    });
    return;
  }

  // Blocking mode: Wait for connection before starting app
  // Initialize performance monitoring and then start app
  void initPerformanceMonitoring({
    platform,
    ...monitoringOptions,
  }).then((connected) => {
    if (connected) {
      // eslint-disable-next-line no-console
      console.log('[Bootstrap] Connected, starting app...');
    } else {
      // eslint-disable-next-line no-console
      console.log(
        '[Bootstrap] Connection timeout, starting app without monitoring...',
      );
    }
    onReady();
  });
}

/**
 * Async version of bootstrap - use with top-level await
 *
 * Usage:
 *   await bootstrapPerfMonitoringAsync({ platform: 'web' });
 *   import('./App');
 */
export async function bootstrapPerfMonitoringAsync(
  options: Omit<IBootstrapOptions, 'onReady'>,
): Promise<boolean> {
  const { platform, enabled, ...monitoringOptions } = options;

  const shouldEnable = enabled ?? isPerfMonitoringEnabled();

  if (!shouldEnable) {
    return false;
  }

  // eslint-disable-next-line no-console
  console.log('[Bootstrap] Performance monitoring enabled, connecting...');

  const connected = await initPerformanceMonitoring({
    platform,
    ...monitoringOptions,
  });

  if (connected) {
    // eslint-disable-next-line no-console
    console.log('[Bootstrap] Connected, starting app...');
  } else {
    // eslint-disable-next-line no-console
    console.log(
      '[Bootstrap] Connection timeout, starting app without monitoring...',
    );
  }

  return connected;
}

export {
  isPerfMonitoringEnabled,
  initPerformanceMonitoring,
  stopPerformanceMonitoring,
} from './performanceMonitor';
