import type { IDesktopApiGlobal } from '@onekeyhq/shared/types/desktopApiPlatformInfo';

import { getDesktopPlatformInfo } from './desktopPlatformInfo';

// Avoid `electron-is-dev` here — it accesses `electron.app` which is
// undefined in the preload/renderer process and would crash at load time.
// esbuild already defines process.env.NODE_ENV at build time, so this is
// equivalent and works in both main and preload contexts.
const isDev = process.env.NODE_ENV !== 'production';

export const Platform = {};

export const NativeModules = {};

export const DeviceEventEmitter = {};

export const InteractionManager = {};

export const NativeEventEmitter = {};

// Exported for the contract test in desktopApiContract.test.ts so drift
// between this builder and IDesktopApiGlobal is caught at test time in
// addition to compile time.
export const buildDesktopApiGlobal = (): IDesktopApiGlobal => ({
  ...getDesktopPlatformInfo(),
  isDev,
});

if (typeof globalThis !== 'undefined') {
  const g = globalThis as typeof globalThis & { __DEV__?: boolean };
  if (typeof g.__DEV__ === 'undefined') {
    g.__DEV__ = isDev;
  }

  if (typeof globalThis.desktopApi === 'undefined') {
    // The `globalThis.desktopApi` type (IDesktopApiLegacy) includes bridge
    // methods (on/ready/isFocused/…) that only exist in the renderer via
    // contextBridge. In the main process bundle those methods are never
    // called, so we install the platform-info subset only. Cast narrows the
    // write to the IDesktopApiGlobal contract.
    (globalThis as unknown as { desktopApi: IDesktopApiGlobal }).desktopApi =
      buildDesktopApiGlobal();
  }
}
