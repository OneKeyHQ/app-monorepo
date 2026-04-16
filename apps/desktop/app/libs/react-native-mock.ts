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

const _globalThis = globalThis as unknown as {
  __DEV__: boolean;
  desktopApi: {
    systemVersion: string;
    platform: string;
    arch: string;
    channel?: string;
    deskChannel: string;
    isMas: boolean;
    isDev: boolean;
  };
};

const getChannel = () => {
  let channel;
  try {
    if (process.platform !== 'linux') return channel;
    // AppImage is detected via the build-time `DESK_CHANNEL=appImage` flag
    // (set in release-desktop-all.yml and baked in by esbuild `define`).
    // Reading `process.env.APPIMAGE` would be ambiguous — it is both a define
    // target (empty on CI) and a runtime value set by the launcher.
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

if (typeof globalThis !== 'undefined') {
  if (typeof _globalThis.__DEV__ === 'undefined') {
    _globalThis.__DEV__ = isDev;
  }

  if (typeof _globalThis.desktopApi === 'undefined') {
    _globalThis.desktopApi = {
      platform: process.platform,
      systemVersion: process.getSystemVersion(),
      arch: process.arch,
      channel: getChannel(),
      // Required by packages/shared/src/platformEnv.ts to compute
      // isDesktopWinMsStore when platformEnv runs in the main process bundle
      // (renderer gets this via preload/IPC instead).
      deskChannel: process.env.DESK_CHANNEL || '',
      isMas: process.mas,
      isDev,
    };
  }
}
