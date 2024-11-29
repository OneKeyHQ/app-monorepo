import type { ComponentType } from 'react';

import * as Sentry from '@sentry/electron/renderer';
import { withErrorBoundary, withProfiler } from '@sentry/react';

import { buildIntegrations } from './basicOptions';

export * from '@sentry/electron/renderer';

export const initSentry = () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  Sentry.init({
    integrations: buildIntegrations(Sentry as any),
  });
};

export const nativeCrash = () => {};

export const withSentryHOC = (
  Component: ComponentType<any>,
): ComponentType<any> => withErrorBoundary(withProfiler(Component), {});

export const navigationIntegration = {
  registerNavigationContainer: (ref: any) => {},
};
