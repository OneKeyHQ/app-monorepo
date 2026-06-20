import type { IDesktopApiGlobal } from '@onekeyhq/shared/types/desktopApiPlatformInfo';

import { getProcessStartAt } from './getProcessStartAt';

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

const getChannel = (): string | undefined => {
  let channel: string | undefined;
  try {
    if (process.platform !== 'linux') return channel;
    // AppImage is detected via the build-time `DESK_CHANNEL=appImage` flag
    // (set in release-desktop-all.yml and baked in by esbuild `define`).
    // We deliberately do not use the runtime `APPIMAGE` env for detection —
    // it can be empty when a wrapper launcher strips it, giving a false
    // negative for what is in fact an AppImage build.
    if (process.env.DESK_CHANNEL === 'appImage') {
      channel = 'appImage';
    } else if (process.env.SNAP) {
      channel = 'snap';
    } else if (process.env.FLATPAK) {
      channel = 'flatpak';
    }
  } catch (_e) {
    // ignore
  }
  return channel;
};

// Exported for the contract test in desktopApiContract.test.ts so drift
// between this builder and IDesktopApiGlobal is caught at test time in
// addition to compile time.
export const buildDesktopApiGlobal = (): IDesktopApiGlobal => ({
  platform: process.platform,
  arch: process.arch,
  systemVersion:
    typeof process.getSystemVersion === 'function'
      ? process.getSystemVersion()
      : '',
  channel: getChannel(),
  deskChannel: process.env.DESK_CHANNEL || '',
  isMas: Boolean(process.mas),
  processStartAt: getProcessStartAt(),
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
