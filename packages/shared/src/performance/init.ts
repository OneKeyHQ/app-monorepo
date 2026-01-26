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
import { isPerfMonitorEnabled } from './enabled';

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
