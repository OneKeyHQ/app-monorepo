import type { ComponentType } from 'react';

import Sentry from '@sentry/electron/renderer';

import { buildIntegrations } from './basicOptions';

export * from '@sentry/electron/renderer';

export const initSentry = () => {
  Sentry.init({
    integrations: buildIntegrations(Sentry as any),
  });
};
export const wrap = (Component: ComponentType<any>): ComponentType<any> =>
  Component;
export const nativeCrash = () => {};
