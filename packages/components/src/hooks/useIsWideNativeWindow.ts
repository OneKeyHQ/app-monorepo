import { useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// A phone window whose short side reaches this is used like a small tablet
// (the iPhone Duo inner display is 669pt); regular phones stay below it.
const WIDE_WINDOW_MIN_SHORT_SIDE = 600;

/**
 * Whether a native iOS window is wide enough for anchored panels instead of
 * phone sheets: always on iPad, and on iPhone windows whose short side is at
 * least 600pt (the iPhone Duo inner display). False on web and Android.
 */
export function useIsWideNativeWindow() {
  const { width, height } = useWindowDimensions();
  if (!platformEnv.isNativeIOS) {
    return false;
  }
  return (
    Boolean(platformEnv.isNativeIOSPad) ||
    Math.min(width, height) >= WIDE_WINDOW_MIN_SHORT_SIDE
  );
}
