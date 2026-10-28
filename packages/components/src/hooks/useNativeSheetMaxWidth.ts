import { useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsWideNativeWindow } from './useIsWideNativeWindow';

// Sheet content on wide iOS windows (iPad, iPhone Duo inner display) stops
// at this width instead of stretching across a wide sheet.
const WIDE_WINDOW_SHEET_MAX_WIDTH = 640;

function useNativeIOSSheetMaxWidth(): number | undefined {
  const isWideWindow = useIsWideNativeWindow();
  const { width } = useWindowDimensions();
  return isWideWindow
    ? Math.min(width, WIDE_WINDOW_SHEET_MAX_WIDTH)
    : undefined;
}

/**
 * Content width cap for native overlay sheets. `undefined` lets the content
 * fill the sheet (phones, Android, web); the overlay itself follows the width
 * the platform gave the sheet, so the cap only centers content on wide sheets.
 */
export const useNativeSheetMaxWidth: () => number | undefined =
  platformEnv.isNativeIOS ? useNativeIOSSheetMaxWidth : () => undefined;
