import type { ComponentType } from 'react';

import * as Sentry from '@sentry/react';

import { basicOptions, buildIntegrations, buildOptions } from './basicOptions';

export * from '@sentry/react';

export * from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  Sentry.init({
    dsn: 'https://fc0d87f5a1ef85df3a6621206fec0357@o4508208799809536.ingest.de.sentry.io/4508320051036240',
    ...basicOptions,
    ...buildOptions(Sentry),
    integrations: buildIntegrations(Sentry),
  });
};

export const nativeCrash = () => {};

export const withSentryHOC = (
  Component: ComponentType<any>,
): ComponentType<any> =>
  Sentry.withErrorBoundary(Sentry.withProfiler(Component), {
    onError: (error, info) => {
      console.error('error', error, info);
    },
  });
