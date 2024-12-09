import type { ComponentType } from 'react';

import {
  init,
  reactNavigationIntegration,
  nativeCrash as sentryNativeCrash,
  withErrorBoundary,
  withProfiler,
  wrap,
} from '@sentry/react-native';

import { basicOptions } from './basicOptions';

export * from '@sentry/react-native';

export const navigationIntegration = reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  init({
    dsn: 'https://efa7cea7131f10dc294bd2c64bd636bf@o4508208799809536.ingest.de.sentry.io/4508208802627664',
    ...basicOptions,
    maxCacheItems: 60,
    enableAppHangTracking: true,
    appHangTimeoutInterval: 5,
    integrations: [navigationIntegration],
  });
};

export const nativeCrash = sentryNativeCrash;

export const withSentryHOC = (
  Component: ComponentType<any>,
): ComponentType<any> => withErrorBoundary(withProfiler(wrap(Component)), {});
