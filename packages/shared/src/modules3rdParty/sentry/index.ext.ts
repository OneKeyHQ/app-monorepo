import type { ComponentType } from 'react';

import * as Sentry from '@sentry/react';

import { basicOptions, buildIntegrations, buildOptions } from './basicOptions';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  Sentry.init({
    dsn: 'https://7850b8d23c313bf0df1bcaead128af6f@o4508208799809536.ingest.de.sentry.io/4508325155831888',
    ...basicOptions,
    ...buildOptions(Sentry),
    integrations: buildIntegrations(Sentry),
  });
};

export * from '@sentry/react';

export * from './basicOptions';

export const nativeCrash = () => {};

export const withSentryHOC = (
  Component: ComponentType<any>,
): ComponentType<any> =>
  Sentry.withErrorBoundary(Sentry.withProfiler(Component), {
    onError: (error, info) => {
      console.error('error', error, info);
    },
  });
