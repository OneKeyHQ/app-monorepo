import isDev from 'electron-is-dev';

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
    isMas: boolean;
    isDev: boolean;
  };
};

const getChannel = () => {
  let channel;
  try {
    if (process.platform === 'linux' && process.env.APPIMAGE) {
      channel = 'appImage';
    } else if (process.platform === 'linux' && process.env.SNAP) {
      channel = 'snap';
    }
  } catch (e) {
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
      isMas: process.mas,
      isDev,
    };
  }
}
