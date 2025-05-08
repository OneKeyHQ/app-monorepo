import type { ComponentType } from 'react';

import {
  hermesProfilingIntegration,
  init,
  reactNativeTracingIntegration,
  nativeCrash as sentryNativeCrash,
  withErrorBoundary,
  withProfiler,
  wrap,
} from '@sentry/react-native';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import appGlobals from '../../appGlobals';

import { buildBasicOptions, navigationIntegration } from './basicOptions';

import type { FallbackRender } from '@sentry/react';

export * from '@sentry/react-native';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  init({
    dsn: 'https://efa7cea7131f10dc294bd2c64bd636bf@o4508208799809536.ingest.de.sentry.io/4508208802627664',
    ...buildBasicOptions({
      onError: (errorMessage, stacktrace) => {
        appGlobals.$defaultLogger?.app.error.log(errorMessage, stacktrace);
      },
    }),
    maxCacheItems: 60,
    enableAppHangTracking: true,
    appHangTimeoutInterval: 5,
    integrations: [
      navigationIntegration,
      reactNativeTracingIntegration(),
      hermesProfilingIntegration({
        platformProfilers: true,
      }),
    ],
    enableAutoPerformanceTracing: true,
  });
};

export const nativeCrash = sentryNativeCrash;

export const withSentryHOC = (
  Component: ComponentType<any>,
  errorBoundaryFallback?: FallbackRender,
): ComponentType<any> =>
  withErrorBoundary(withProfiler(wrap(Component)), {
    onError: (error, info) => {
      console.error('error', error, info);
    },
    fallback: errorBoundaryFallback,
  });
