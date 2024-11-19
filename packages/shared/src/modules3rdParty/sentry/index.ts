import type { ComponentType } from 'react';

import Sentry from '@sentry/react';

import { buildIntegrations } from './basicOptions';

export * from '@sentry/react';

export const initSentry = () => {
  init({
    dsn: 'https://fc0d87f5a1ef85df3a6621206fec0357@o4508208799809536.ingest.de.sentry.io/4508320051036240',
    integrations: buildIntegrations(Sentry),
  });
};

export const wrap = (Component: ComponentType<any>): ComponentType<any> =>
  Component;
export const nativeCrash = () => {};
