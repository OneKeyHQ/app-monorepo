import { useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getOverlayWidthClass } from './useOverlayWidthClass';

// A phone window whose short side reaches this is used like a small tablet
// (the iPhone Duo inner display is 669pt); regular phones stay below it.
const WIDE_WINDOW_MIN_SHORT_SIDE = 600;

function useIsWideNativeIOSWindow() {
  const { width, height } = useWindowDimensions();
  return platformEnv.isNativeIOSPad
    ? getOverlayWidthClass(width) === 'expanded'
    : Math.min(width, height) >= WIDE_WINDOW_MIN_SHORT_SIDE;
}

/**
 * Whether a native iOS window is wide enough for anchored panels instead of
 * phone sheets: expanded-width iPad windows, and iPhone windows whose short
 * side is at least 600pt (the iPhone Duo inner display). False on web and Android.
 */
export const useIsWideNativeWindow: () => boolean = platformEnv.isNativeIOS
  ? useIsWideNativeIOSWindow
  : () => false;
