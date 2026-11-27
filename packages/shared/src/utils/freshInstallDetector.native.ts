import {
  initFirstLaunch,
  isFirstLaunch,
  isFirstLaunchForCurrentAppVersion,
  isFirstLaunchForCurrentBundle,
  resetFirstLaunch,
} from '@onekeyfe/react-native-device-utils/first-launch';

import RNFS from '../modules3rdParty/react-native-fs';
import platformEnv from '../platformEnv';
import { travelModeManager } from '../travelMode';

const FIRST_LAUNCH_RESET_MARKER = '.onekey_first_launch_reset';

export function initFirstLaunchForApp(): void {
  try {
    initFirstLaunch({
      bundleVersion: platformEnv.bundleVersion,
    });
  } catch {
    // Older native hosts loaded via OTA may not expose first-launch methods.
  }
}

export function isFreshInstallSync(): boolean {
  if (
    !platformEnv.isNativeMainThread ||
    travelModeManager.isMaskingDataSync()
  ) {
    return false;
  }
  try {
    return isFirstLaunch();
  } catch {
    return false;
  }
}

export async function resetFirstLaunchState(): Promise<boolean> {
  let resetSucceeded = false;
  try {
    resetSucceeded = resetFirstLaunch();
  } catch (error) {
    // Older native hosts without resetFirstLaunch have no native first-launch
    // state to clear, so let Reset App proceed.
    if (error instanceof TypeError) {
      return true;
    }
    return false;
  }
  if (!resetSucceeded) {
    return false;
  }
  try {
    if (RNFS?.DocumentDirectoryPath) {
      await RNFS.writeFile(
        `${RNFS.DocumentDirectoryPath}/${FIRST_LAUNCH_RESET_MARKER}`,
        '1',
        'utf8',
      );
    }
  } catch {
    // Best effort: native startup falls back to legacy checks if unavailable.
  }
  return true;
}

export {
  isFirstLaunch,
  isFirstLaunchForCurrentAppVersion,
  isFirstLaunchForCurrentBundle,
};
