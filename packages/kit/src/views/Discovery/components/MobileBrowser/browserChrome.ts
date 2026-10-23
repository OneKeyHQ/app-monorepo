import { useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBrowserToolbarAction } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/browser';
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

// Flips only when crossing the crossfade point, so each chrome component can
// route touches to its visible layer without re-rendering every frame (and
// without re-rendering the whole browser page).
export function useIsChromeCollapsed(progress?: SharedValue<number>) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  useAnimatedReaction(
    () => (progress ? progress.value < BROWSER_CHROME_CROSSFADE_POINT : false),
    (collapsed, previous) => {
      if (collapsed !== previous) {
        runOnJS(setIsCollapsed)(collapsed);
      }
    },
    [progress],
  );
  return isCollapsed;
}
