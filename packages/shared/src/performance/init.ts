/**
 * Performance Monitoring Auto-Init (Side-Effect Module)
 *
 * Import this module at the very top of your entry file to enable performance monitoring.
 * It auto-detects the platform and initializes in non-blocking mode.
 *
 * Usage:
 *   import '@onekeyhq/shared/src/performance/init';
 */
/* eslint-disable @typescript-eslint/no-var-requires */

// Initialize debug timestamp as early as possible (dev only)
// This must run before any other imports to avoid NaN in LANDING_DEBUG logs
// oxlint-disable-next-line import/first
import { isPerfMonitorEnabled } from './enabled';

if (process.env.NODE_ENV !== 'production') {
  (globalThis as any).$$debugT0 =
    (globalThis as any).$$debugT0 ?? performance.now();
}

/**
 * Unified debug logger for landing/startup performance tracing (dev only).
 * All calls are tree-shaken in production because the caller wraps them
 * with `process.env.NODE_ENV !== 'production'`.
 */
export function debugLandingLog(label: string, extra?: string) {
  const elapsed = (
    performance.now() - ((globalThis as any).$$debugT0 ?? 0)
  ).toFixed(1);
  const suffix = extra ? `, ${extra}` : '';
  console.log(`[LANDING_DEBUG] ${label}${suffix}, +${elapsed}ms`);
}

if (isPerfMonitorEnabled()) {
  const { perfMark } = require('./mark') as typeof import('./mark');
  perfMark('app:start');

  const { installFunctionHitLogger } =
    require('./functionHitLogger') as typeof import('./functionHitLogger');
  installFunctionHitLogger();

  const platformEnv = (
    require('../platformEnv') as typeof import('../platformEnv')
  ).default;
  let platform: 'android' | 'ios' | 'desktop' | 'ext' | 'web' = 'web';
  if (platformEnv.isNativeAndroid) {
    platform = 'android';
  } else if (platformEnv.isNativeIOS) {
    platform = 'ios';
  } else if (platformEnv.isDesktop) {
    platform = 'desktop';
  } else if (platformEnv.isExtension) {
    platform = 'ext';
  }

  const { initPerformanceMonitoring } =
    require('./performanceMonitor') as typeof import('./performanceMonitor');
  void initPerformanceMonitoring({ platform });
}
