import type { ComponentType } from 'react';

import Sentry from '@sentry/react';

import { buildIntegrations } from './basicOptions';

export const initSentry = () => {
  Sentry.init({
    dsn: 'https://7850b8d23c313bf0df1bcaead128af6f@o4508208799809536.ingest.de.sentry.io/4508325155831888',
    integrations: buildIntegrations(Sentry),
  });
};

export * from '@sentry/react';
export const wrap = (Component: ComponentType<any>): ComponentType<any> =>
  Component;
export const nativeCrash = () => {};
