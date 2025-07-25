import type { ComponentType } from 'react';

import * as Sentry from '@sentry/electron/renderer';
import { withErrorBoundary, withProfiler } from '@sentry/react';

import { buildIntegrations } from './basicOptions';

import type { FallbackRender } from '@sentry/react';

export * from '@sentry/electron/renderer';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  Sentry.init({
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    integrations: buildIntegrations(Sentry as any),
  });
};

export const nativeCrash = () => {};

export const withSentryHOC = (
  Component: ComponentType<any>,
  errorBoundaryFallback?: FallbackRender,
): ComponentType<any> =>
  withErrorBoundary(withProfiler(Component), {
    onError: (error, info) => {
      console.error('error', error, info);
    },
    fallback: errorBoundaryFallback,
  });
