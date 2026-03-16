import type { ComponentType } from 'react';

import * as Sentry from '@sentry/electron/renderer';
import { withErrorBoundary, withProfiler } from '@sentry/react';

import { buildBasicOptions, buildIntegrations } from './basicOptions';

import type { FallbackRender } from '@sentry/react';

// oxlint-disable-next-line import/export -- re-export from third-party module
export * from '@sentry/electron/renderer';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const basicOptions = buildBasicOptions({
    onError: () => {
      // Desktop renderer errors are handled by the main process
    },
  });
  Sentry.init({
    ...basicOptions,
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
