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

import { buildBasicOptions, navigationIntegration } from './basicOptions';

import type { FallbackRender } from '@sentry/react';

// oxlint-disable-next-line import/export -- re-export from third-party module
export * from '@sentry/react-native';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  init({
    dsn: process.env.SENTRY_DSN_REACT_NATIVE || '',
    ...buildBasicOptions({
      onError: (errorMessage, stacktrace) => {
        appGlobals.$defaultLogger?.app.error.log(errorMessage, stacktrace);
      },
    }),
    maxCacheItems: 60,
    enableAppHangTracking: true,
    appHangTimeoutInterval: 5,
    integrations: [navigationIntegration, reactNativeTracingIntegration()],
    enableAutoPerformanceTracing: true,
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
