import {
  AndroidSoftInputModes,
  KeyboardController,
} from 'react-native-keyboard-controller';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export {
  useReanimatedKeyboardAnimation,
  useKeyboardState,
} from 'react-native-keyboard-controller';

/**
 * Android only: stop the window from panning to the focused input while the
 * caller lifts its own content above the keyboard (the manifest's adjustPan
 * would otherwise move the whole window on top of that lift). Pair with
 * `restoreAndroidSoftInputMode` once the input leaves.
 */
export function suspendAndroidSoftInputPan(): void {
  if (!platformEnv.isNativeAndroid) {
    return;
  }
  KeyboardController.setInputMode(
    AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING,
  );
}

/** Puts the manifest's soft-input mode back after `suspendAndroidSoftInputPan`. */
export function restoreAndroidSoftInputMode(): void {
  if (!platformEnv.isNativeAndroid) {
    return;
  }
  KeyboardController.setDefaultMode();
}
