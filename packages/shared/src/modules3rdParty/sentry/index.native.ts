import type { ComponentType } from 'react';

import {
  init,
  reactNativeTracingIntegration,
  nativeCrash as sentryNativeCrash,
  withErrorBoundary,
  withProfiler,
  wrap,
} from '@sentry/react-native';

import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';

import { buildBasicOptions, navigationIntegration } from './basicOptions';

import type { FallbackRender } from '@sentry/react';

// oxlint-disable-next-line import/export -- re-export from third-party module
export * from '@sentry/react-native';

export * from './basicOptions';

// Unified release identifier shared with `SENTRY_RELEASE` in
// apps/mobile/build-bundle-base.js (`<appVersion>+<buildNumber>+<bundleVersion>`).
// Keeping the runtime SDK and the sourcemap-upload pipeline on the same
// release name is what lets Sentry pair stack frames against maps uploaded
// by `uploadDirectoryToSentry` (main.jsbundle, common.jsbundle, segments).
// Without this override, @sentry/react-native auto-infers a per-platform
// name (`so.onekey.<app>.wallet@<appVersion>+<buildNumber>`) that
// `uploadDirectoryToSentry` never targets, so common.bundle frames can't
// be symbolicated.
const resolveUnifiedRelease = () => {
  const parts = [
    platformEnv.version,
    platformEnv.buildNumber,
    platformEnv.bundleVersion,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join('+') : undefined;
};

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const { profilesSampleRate: _profilesSampleRate, ...basicOptions } =
    buildBasicOptions({
      onError: (errorMessage, stacktrace) => {
        appGlobals.$defaultLogger?.app.error.log(errorMessage, stacktrace);
      },
    });

  const unifiedRelease = resolveUnifiedRelease();

  init({
    dsn: process.env.SENTRY_DSN_REACT_NATIVE || '',
    ...basicOptions,
    ...(unifiedRelease ? { release: unifiedRelease } : null),
    ...(platformEnv.bundleVersion ? { dist: platformEnv.bundleVersion } : null),
    maxCacheItems: 60,
    enableAppHangTracking: true,
    appHangTimeoutInterval: 5,
    integrations: [navigationIntegration, reactNativeTracingIntegration()],
    enableAutoPerformanceTracing: true,
    // Disable Hermes profiling on React Native. With multiple Hermes runtimes
    // in the iOS release smoke test, native stopProfiling can throw on a
    // background queue and crash during TurboModule error conversion.
    // Disable options that may include sensitive memory context or visual data.
    // enableNativeCrashHandling and enableNdk are kept enabled because they only
    // collect stack traces and thread stack memory (not Hermes JS
    // heap), which is safe for privacy and essential for diagnosing native crashes.
    enableNativeCrashHandling: true,
    enableNdk: true,
    enableWatchdogTerminationTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
  });
};

export const nativeCrash = sentryNativeCrash;

export const withSentryHOC = (
  Component: ComponentType<any>,
  errorBoundaryFallback?: FallbackRender,
): ComponentType<any> =>
  withErrorBoundary(withProfiler(wrap(Component)), {
    onError: (error, info) => {
      console.error('withErrorBoundary', error, info);
      appGlobals.$defaultLogger?.app.error.log(
        `${
          typeof error === 'string' ? error : (error as Error)?.message || ''
        } ${typeof info === 'string' ? info : ''}`,
      );
    },
    fallback: errorBoundaryFallback,
  });
