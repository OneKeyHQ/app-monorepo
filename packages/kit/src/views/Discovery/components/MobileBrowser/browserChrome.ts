import { useState } from 'react';

import {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { BROWSER_HEADER_CROSSFADE_POINT } from '../../config/Animation.constants';

import type { SharedValue } from 'react-native-reanimated';

// iOS uses the Safari-style chrome: the address lives in a floating glass
// bottom bar, and a compact address pill stays visible while collapsed.
export const isCompactBrowserChrome = platformEnv.isNativeIOS;

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
    () => progress.value < BROWSER_HEADER_CROSSFADE_POINT,
    (collapsed, previous) => {
      if (collapsed !== previous) {
        runOnJS(setIsCollapsed)(collapsed);
      }
    },
  );
  return isCollapsed;
}

// The expanded layer fades out in the first half of a collapse while the
// collapsed layer fades in during the second half, so they never overlap.
// Opacity + translate only: scaling Liquid Glass re-composites every frame.
export function useChromeCrossfadeStyles(
  progress: SharedValue<number>,
  { hiddenOffsetY }: { hiddenOffsetY: number },
) {
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [BROWSER_HEADER_CROSSFADE_POINT, 1],
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
  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, BROWSER_HEADER_CROSSFADE_POINT],
      [1, 0],
      'clamp',
    ),
  }));
  return { expandedStyle, collapsedStyle };
}
