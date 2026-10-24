import { useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBrowserToolbarAction } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/browser';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_CROSSFADE_POINT,
  BROWSER_COLLAPSED_PILL_HEIGHT,
} from '../../config/Animation.constants';

import type { SharedValue } from 'react-native-reanimated';

const BAR_TOP_GAP = 8;

// Scroll-driven chrome state shared by the header and the bottom bar.
// `progress`: 1 = expanded, 0 = collapsed.
export interface IMobileBrowserChrome {
  progress: SharedValue<number>;
  onExpand: () => void;
  onSearchBarPress: (url: string) => void;
}

// iOS's bottom inset (~34pt) leaves room below the home indicator, so the
// chrome dips into it like Safari. Android's gesture-bar inset is much
// shorter (~16-24dp, or 0 when the app isn't drawn edge-to-edge), with the
// handle near its top, so the chrome sits fully above it.
const isAndroid = platformEnv.isNativeAndroid;

// How far the capsule's back button is pulled toward the site badge: its
// narrow chevron leaves a wider gap there than to the capsule edge. Measured
// per platform (solid Android capsule vs iOS glass) so both gaps match.
export const CAPSULE_BACK_BUTTON_PULL = isAndroid ? 6 : 4;

// Sits just above the home indicator / gesture handle.
export function getCollapsedPillBottom(bottomInset: number) {
  return isAndroid ? bottomInset + 4 : Math.max(bottomInset - 20, 8);
}

// Bottom edge of the expanded bar's capsules. On iOS they sit low, dipping
// into the bottom safe area just above the home indicator (like Safari),
// instead of stacking a full toolbar on top of the inset.
export function getBarCapsuleBottom(bottomInset: number) {
  return isAndroid ? bottomInset + 8 : Math.max(bottomInset - 10, 8);
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

// Height the collapsed address pill covers from the screen bottom.
export function getCollapsedReservedHeight(bottomInset: number) {
  return (
    getCollapsedPillBottom(bottomInset) + BROWSER_COLLAPSED_PILL_HEIGHT + 4
  );
}

export function logBrowserChromeAction(
  action: IBrowserToolbarAction,
  entry: 'toolbar' | 'menu' | 'header',
) {
  defaultLogger.discovery.browser.browserToolbarAction({ action, entry });
}

export function getDisplayHostname(url?: string) {
  if (!url) {
    return '';
  }
  return uriUtils.safeParseURL(url)?.hostname || url;
}

// Whether `progress` is past `edge` (below it, or above it); flips only when
// crossing the edge, so a component re-renders once per crossing rather than
// every frame.
export function useIsProgressPast(
  progress: SharedValue<number> | undefined,
  edge: number,
  direction: 'below' | 'above' = 'below',
) {
  const [isPast, setIsPast] = useState(false);
  useAnimatedReaction(
    () => {
      if (!progress) {
        return false;
      }
      return direction === 'below'
        ? progress.value < edge
        : progress.value > edge;
    },
    (past, previous) => {
      if (past !== previous) {
        runOnJS(setIsPast)(past);
      }
    },
    [progress, edge, direction],
  );
  return isPast;
}

// Flips at the crossfade point, so each chrome component can route touches
// to its visible layer without re-rendering every frame (and without
// re-rendering the whole browser page).
export function useIsChromeCollapsed(progress?: SharedValue<number>) {
  return useIsProgressPast(progress, BROWSER_CHROME_CROSSFADE_POINT);
}

// Tap-area extension for ChromePressable. Pass a stable (module-level)
// object: the gesture is rebuilt when it changes.
export type IChromeHitSlop = { vertical?: number; horizontal?: number };

// Capsule buttons render ~36pt inside the 46pt capsules; this slop makes the
// whole capsule height tappable.
export const CAPSULE_BUTTON_HIT_SLOP: IChromeHitSlop = { vertical: 5 };
