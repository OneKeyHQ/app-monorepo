import isDev from 'electron-is-dev';

export const Platform = {};

export const NativeModules = {};

export const DeviceEventEmitter = {};

export const InteractionManager = {};

export const NativeEventEmitter = {};

if (
  typeof globalThis !== 'undefined' &&
  typeof (
    globalThis as unknown as {
      __DEV__: boolean;
    }
  ).__DEV__ === 'undefined'
) {
  (
    globalThis as unknown as {
      __DEV__: boolean;
    }
  ).__DEV__ = isDev;
}
