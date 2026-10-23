import { useState } from 'react';

import {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_CROSSFADE_POINT,
} from '../../config/Animation.constants';

import type { SharedValue } from 'react-native-reanimated';

const BAR_TOP_GAP = 8;

// Safari-style chrome on both platforms: the address lives in the bottom bar
// and a compact address pill stays visible while collapsed. Only iOS 26+ lets
// the bar float over the page: the WebView's contentInset keeps scrollable
// content reachable above it, and obscuredContentInsets (patched into
// react-native-webview) keeps the page's fixed elements, like bottom sheets,
// above it as in Safari. Older iOS and Android resize the WebView instead.
export const isFloatingBrowserChrome = !!platformEnv.isNativeIOS26Plus;

// Scroll-driven chrome state shared by the header and the bottom bar.
// `progress`: 1 = expanded, 0 = collapsed.
export interface IMobileBrowserChrome {
  progress: SharedValue<number>;
  onExpand: () => void;
  onSearchBarPress: (url: string) => void;
}

// Sits just above the home indicator, overlapping the bottom safe area.
export function getCollapsedPillBottom(bottomInset: number) {
  return Math.max(bottomInset - 20, 8);
}

// Bottom edge of the expanded bar's capsules. Like Safari, they sit low,
// dipping into the bottom safe area just above the home indicator, instead of
// stacking a full toolbar on top of the inset.
export function getBarCapsuleBottom(bottomInset: number) {
  return Math.max(bottomInset - 10, 8);
}

// Height the expanded bar covers from the screen bottom (capsules plus a gap
// above them); the WebView reserves this much room for it.
export function getBarReservedHeight(bottomInset: number) {
  return (
    getBarCapsuleBottom(bottomInset) +
    BROWSER_CHROME_CAPSULE_HEIGHT +
    BAR_TOP_GAP
  );
}

export function getDisplayHostname(url?: string) {
  if (!url) {
    return '';
  }
  return uriUtils.safeParseURL(url)?.hostname || url;
}

// Flips only when crossing the crossfade point, so each chrome component can
// route touches to its visible layer without re-rendering every frame (and
// without re-rendering the whole browser page).
export function useIsChromeCollapsed(progress: SharedValue<number>) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  useAnimatedReaction(
    () => progress.value < BROWSER_CHROME_CROSSFADE_POINT,
    (collapsed, previous) => {
      if (collapsed !== previous) {
        runOnJS(setIsCollapsed)(collapsed);
      }
    },
  );
  return isCollapsed;
}

// Fades the header out in the first half of a collapse (opacity + a small
// slide), so it is gone before its row height reaches zero.
export function useChromeExpandedStyle(
  progress: SharedValue<number>,
  { hiddenOffsetY }: { hiddenOffsetY: number },
) {
  return useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [BROWSER_CHROME_CROSSFADE_POINT, 1],
      [0, 1],
      'clamp',
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [hiddenOffsetY, 0],
          'clamp',
        ),
      },
    ],
  }));
}
