import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import * as ScreenOrientation from 'expo-screen-orientation';
import { noop } from 'lodash';

import { isFoldableIPhone } from '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let isInitialized = false;

function unlockOrientation() {
  void ScreenOrientation.unlockAsync().catch(noop);
}

// Foldable iPhones (iPhone Duo) are used in every orientation: the inner
// display is landscape-native, and keeping the app-wide portrait lock there
// makes iOS rotate the whole UI by 90 degrees. Drop the lock at launch.
export function initIPhoneDuoOrientation() {
  if (isInitialized || !platformEnv.isNativeIOS || platformEnv.isNativeIOSPad) {
    return;
  }
  isInitialized = true;

  // Share the app-wide classification, so a native false positive on a
  // regular iPhone never drops the portrait lock. Keep this after 6.8.0: only
  // the temporary model-id check inside isFoldableIPhone() is removed then.
  if (isFoldableIPhone()) {
    unlockOrientation();
    return;
  }

  // Unlisted models are only confirmed by the native hinge check, which
  // reports through the spanning listener once the hinge is first seen.
  const listenerId = ReactNativeDeviceUtils.addSpanningChangedListener(() => {
    if (!isFoldableIPhone()) {
      return;
    }
    ReactNativeDeviceUtils.removeSpanningChangedListener(listenerId);
    unlockOrientation();
  });
}
