import { useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useMedia } from './useStyle';

// Overlay presentation follows the window width alone, the same on every
// platform (see "Adaptive presentation by window width" in the
// react-native-native-overlay SPEC):
// - compact  (< 640): full-width sheets
// - medium   (640-767): max-width sheets
// - expanded (>= 768): centered dialogs, anchored menus, max-width sheets
export type IOverlayWidthClass = 'compact' | 'medium' | 'expanded';

export const OVERLAY_MEDIUM_MIN_WIDTH = 640;
export const OVERLAY_EXPANDED_MIN_WIDTH = 768;
// Widest a sheet surface gets; narrower windows fill their width.
export const OVERLAY_SHEET_MAX_WIDTH = 540;

export function getOverlayWidthClass(width: number): IOverlayWidthClass {
  if (width >= OVERLAY_EXPANDED_MIN_WIDTH) return 'expanded';
  if (width >= OVERLAY_MEDIUM_MIN_WIDTH) return 'medium';
  return 'compact';
}

function useNativeOverlayWidthClass(): IOverlayWidthClass {
  // Native media is clamped to a phone's short side, so read the window.
  const { width } = useWindowDimensions();
  return getOverlayWidthClass(width);
}

function useWebOverlayWidthClass(): IOverlayWidthClass {
  // Web media is the real viewport width and shares these breakpoints.
  const { gtMd, gtSm } = useMedia();
  if (gtMd) return 'expanded';
  return gtSm ? 'medium' : 'compact';
}

export const useOverlayWidthClass: () => IOverlayWidthClass =
  platformEnv.isNative ? useNativeOverlayWidthClass : useWebOverlayWidthClass;
