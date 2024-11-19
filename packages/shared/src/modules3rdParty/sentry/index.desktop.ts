import { init } from '@sentry/electron/renderer';

export * from '@sentry/electron/renderer';

export const initSentry = () => {
  init();
};
export const wrap = (Component: ComponentType<T>): ComponentType<T> =>
  Component;
export const nativeCrash = () => {};
