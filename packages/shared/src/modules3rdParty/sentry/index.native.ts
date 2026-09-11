import type { ComponentType } from 'react';

import {
  captureException,
  init,
  reactNativeErrorHandlersIntegration,
  nativeCrash as sentryNativeCrash,
  withErrorBoundary,
  withProfiler,
  wrap,
} from '@sentry/react-native';
import {
  createSyntheticError,
  isErrorLike,
} from '@sentry/react-native/dist/js/utils/error';

import appGlobals from '../../appGlobals';
import { setNativePromiseRejectionTrackingOptions } from '../../errors/nativePromiseRejectionTracker.native';

import {
  buildBasicOptions,
  sanitizeNavigationBreadcrumbsForLocalLog,
  sanitizeSentryEvent,
} from './basicOptions';

import type { ISentrySanitizationErrorHandler } from './basicOptions';
import type { FallbackRender } from '@sentry/react';

// oxlint-disable-next-line import/export -- re-export from third-party module
export * from '@sentry/react-native';

export * from './basicOptions';

function getNativePromiseIntegrations(): ReturnType<
  typeof reactNativeErrorHandlersIntegration
>[] {
  const hermes = (
    globalThis as typeof globalThis & {
      HermesInternal?: { hasPromise?: () => boolean };
    }
  ).HermesInternal;
  if (process.env.ONEKEY_MOBILE_LOCKDOWN === 'false' || !hermes?.hasPromise?.())
    return [];
  return [
    // Keep the SDK's synchronous/native error chain. Its default Hermes
    // rejection setup mutates Promise and cannot run after lockdown.
    reactNativeErrorHandlersIntegration({ onunhandledrejection: false }),
    {
      name: 'OneKeyHermesPromiseErrors',
      setupOnce() {
        setNativePromiseRejectionTrackingOptions({
          allRejections: true,
          onUnhandled: (id, error) => {
            // Preserve Sentry's native rejection mechanism and its standard
            // captureException normalization for Error and non-Error values.
            captureException(error, {
              data: { id },
              originalException: error,
              syntheticException: isErrorLike(error)
                ? undefined
                : createSyntheticError(),
              mechanism: { handled: true, type: 'onunhandledrejection' },
            });
          },
          onHandled: (id) => {
            if (__DEV__) {
              console.warn(`Promise Rejection Handled (id: ${id})`);
            }
          },
        });
      },
    },
  ];
}

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
  const onError: ISentrySanitizationErrorHandler = (
    errorMessage,
    stacktrace,
  ) => {
    appGlobals.$defaultLogger?.app.error.log(errorMessage, stacktrace);
  };
  const {
    tracesSampleRate: _tracesSampleRate,
    profilesSampleRate: _profilesSampleRate,
    ...basicOptions
  } = buildBasicOptions({
    onError,
  });
  type INativeSentryOptions = Parameters<typeof init>[0];
  const nativeBeforeSend: NonNullable<INativeSentryOptions['beforeSend']> = (
    event,
  ) => {
    const navigationBreadcrumbs = sanitizeNavigationBreadcrumbsForLocalLog(
      event.breadcrumbs,
    );
    if (navigationBreadcrumbs.length > 0) {
      const breadcrumbText = navigationBreadcrumbs
        .map(({ message, from, to }) =>
          [message, from ? `from=${from}` : '', to ? `to=${to}` : '']
            .filter(Boolean)
            .join(' '),
        )
        .filter(Boolean)
        .join(' | ');
      if (breadcrumbText) {
        appGlobals.$defaultLogger?.app.error.log(
          `[SentryNavigationBreadcrumbs] ${breadcrumbText}`,
        );
      }
    }
    const sanitizedEvent = sanitizeSentryEvent(event, onError);
    if (sanitizedEvent) {
      sanitizedEvent.breadcrumbs = [];
    }
    return sanitizedEvent;
  };
  const nativeBasicOptions = {
    enabled: basicOptions.enabled,
    maxBreadcrumbs: basicOptions.maxBreadcrumbs,
    beforeSend: nativeBeforeSend,
  };
  init({
    dsn: process.env.SENTRY_DSN_REACT_NATIVE || '',
    ...nativeBasicOptions,
    attachScreenshot: false,
    attachViewHierarchy: false,
    sendDefaultPii: false,
    autoInitializeNativeSdk: false,
    // Performance tracing fully disabled on native — tracesSampleRate is
    // stripped above so the SDK installs none of its default tracing
    // integrations; error reporting + breadcrumbs are unaffected.
    integrations: getNativePromiseIntegrations(),
    enableAutoPerformanceTracing: false,
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
