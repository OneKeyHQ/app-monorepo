import type { ComponentType } from 'react';

import {
  init,
  nativeCrash as sentryNativeCrash,
  withErrorBoundary,
  withProfiler,
  wrap,
} from '@sentry/react-native';

import appGlobals from '../../appGlobals';

import { buildBasicOptions } from './basicOptions';

import type { FallbackRender } from '@sentry/react';
import type { ReactNativeOptions } from '@sentry/react-native';

// oxlint-disable-next-line import/export -- re-export from third-party module
export * from '@sentry/react-native';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  // Strip tracesSampleRate AND profilesSampleRate before handing options to the
  // RN SDK. @sentry/react-native's getDefaultIntegrations treats tracing as
  // ENABLED whenever `typeof tracesSampleRate === 'number'` (0 included), and
  // `integrations: []` only MERGES with — does not override — the default set.
  // So a leftover `tracesSampleRate: 0` would re-install the default tracing
  // integrations (appStart / nativeFrames / stallTracking / timeToDisplay)
  // regardless of `enableAutoPerformanceTracing: false`. Removing the key makes
  // hasTracingEnabled=false so none of them are installed. profilesSampleRate is
  // likewise stripped to keep hermesProfilingIntegration off.
  const {
    tracesSampleRate: _tracesSampleRate,
    profilesSampleRate: _profilesSampleRate,
    ...basicOptions
  } = buildBasicOptions({
    onError: (errorMessage, stacktrace) => {
      appGlobals.$defaultLogger?.app.error.log(errorMessage, stacktrace);
    },
  });

  init({
    dsn: process.env.SENTRY_DSN_REACT_NATIVE || '',
    // buildBasicOptions is typed against @sentry/browser, which resolves
    // @sentry/core 8, while @sentry/react-native pins @sentry/core 10.37.0
    // exactly - SDK 56 dropped the @sentry/* resolutions that used to hold
    // both on 8, and the RN SDK cannot go back. The option shape is the same;
    // only the two vendored copies of the types disagree, on DataCategory
    // ('log_byte' is 10-only), PropagationContext.sampleRand and the like.
    // Cast the shared block rather than strip its keys one at a time; every
    // option this file sets below stays checked.
    ...(basicOptions as ReactNativeOptions),
    maxCacheItems: 60,
    enableAppHangTracking: true,
    appHangTimeoutInterval: 5,
    // Performance tracing fully disabled on native — tracesSampleRate is
    // stripped above so the SDK installs none of its default tracing
    // integrations; error reporting + breadcrumbs are unaffected.
    integrations: [],
    enableAutoPerformanceTracing: false,
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
