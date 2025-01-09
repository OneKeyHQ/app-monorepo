import type { ComponentType } from 'react';

import * as Sentry from '@sentry/electron/renderer';
import { withErrorBoundary, withProfiler } from '@sentry/react';

import { buildIntegrations } from './basicOptions';

export * from '@sentry/electron/renderer';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  Sentry.init({
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    integrations: buildIntegrations(Sentry as any),
  });
};

export const nativeCrash = () => {};

export const withSentryHOC = (
  Component: ComponentType<any>,
): ComponentType<any> =>
  withErrorBoundary(withProfiler(Component), {
    onError: (error, info) => {
      console.error('error', error, info);
    },
  });
