import type { ComponentType } from 'react';

import { init } from '@sentry/react';

export const initSentry = () => {
  init({
    dsn: 'https://7850b8d23c313bf0df1bcaead128af6f@o4508208799809536.ingest.de.sentry.io/4508325155831888',
  });
};

export * from '@sentry/react';
export const wrap = (Component: ComponentType<any>): ComponentType<any> =>
  Component;
export const nativeCrash = () => {};
