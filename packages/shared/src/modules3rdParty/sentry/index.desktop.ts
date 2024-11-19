import type { ComponentType } from 'react';

import { init } from '@sentry/electron/renderer';

export * from '@sentry/electron/renderer';

export const initSentry = () => {
  init();
};
export const wrap = (Component: ComponentType<any>): ComponentType<any> =>
  Component;
export const nativeCrash = () => {};
