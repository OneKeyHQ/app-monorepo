import {
  initFirstLaunch,
  isFirstLaunch,
  isFirstLaunchForCurrentAppVersion,
  isFirstLaunchForCurrentBundle,
  resetFirstLaunch,
} from '@onekeyfe/react-native-device-utils/first-launch';

import platformEnv from '../platformEnv';

export function initFirstLaunchForApp(): void {
  const runtime = globalThis as typeof globalThis & {
    __ONEKEY_LEGACY_INSTALL__?: boolean;
  };
  initFirstLaunch({
    appVersion: platformEnv.version,
    bundleVersion: platformEnv.bundleVersion,
    isLegacyInstall: Boolean(runtime.__ONEKEY_LEGACY_INSTALL__),
  });
}

export function isFreshInstallSync(): boolean {
  return false;
}

export async function resetFirstLaunchState(): Promise<boolean> {
  if (typeof globalThis.window === 'undefined') {
    return true;
  }
  return Promise.resolve(resetFirstLaunch());
}

export {
  isFirstLaunch,
  isFirstLaunchForCurrentAppVersion,
  isFirstLaunchForCurrentBundle,
};
