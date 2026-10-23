import { useState, useSyncExternalStore } from 'react';

import semver from 'semver';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBrowserToolbarAction } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/browser';
import { BundleUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_CROSSFADE_POINT,
  BROWSER_COLLAPSED_PILL_HEIGHT,
} from '../../config/Animation.constants';

import type { SharedValue } from 'react-native-reanimated';

const BAR_TOP_GAP = 8;

// Safari-style chrome on both platforms: the address lives in the bottom bar
// and a compact address pill stays visible while collapsed. Only iOS 26+ lets
// the bar float over the page: the WebView's contentInset keeps scrollable
// content reachable above it, and obscuredContentInsets (patched into
// react-native-webview) keeps the page's fixed elements, like bottom sheets,
// above it as in Safari. Older iOS and Android resize the WebView instead.
//
// The obscuredContentInsets patch is native, so a JS bundle updated over the
// air can run on an older native build without it; floating there would hide
// fixed page content again. Float only once the native app is known to carry
// it, and resize the WebView (the safe layout) until then.
const FLOATING_CHROME_MIN_NATIVE_VERSION = '6.7.0';

// Local builds carry the patch from patches/ whatever their version.
let floatingChromeSupported =
  !!platformEnv.isNativeIOS26Plus && !!platformEnv.isDev;
let floatingChromeChecked =
  !platformEnv.isNativeIOS26Plus || !!platformEnv.isDev;
const floatingChromeListeners = new Set<() => void>();

// Read the native version lazily, the first time the browser chrome mounts,
// rather than as a side effect of importing this module at startup.
function checkFloatingChromeSupport() {
  if (floatingChromeChecked) {
    return;
  }
  floatingChromeChecked = true;
  void BundleUpdate.getNativeAppVersion()
    .then((nativeVersion) => {
      const version = semver.coerce(nativeVersion);
      floatingChromeSupported =
        !!version && semver.gte(version, FLOATING_CHROME_MIN_NATIVE_VERSION);
      floatingChromeListeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

function subscribeFloatingChrome(listener: () => void) {
  floatingChromeListeners.add(listener);
  checkFloatingChromeSupport();
  return () => {
    floatingChromeListeners.delete(listener);
  };
}

export function useIsFloatingBrowserChrome() {
  return useSyncExternalStore(
    subscribeFloatingChrome,
    () => floatingChromeSupported,
    () => floatingChromeSupported,
  );
}

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

// The bottom area the floating bar covers, in each chrome state.
export interface IChromeBottomInset {
  progress: SharedValue<number>;
  expanded: number;
  collapsed: number;
}

// Current bottom inset for the WebView: follows the bar as it collapses and
// expands (flipping at the crossfade point, not every frame). Only the active
// tab tracks it; background tabs keep the expanded value so they don't
// re-render on every scroll gesture.
export function useChromeBottomInset(
  inset: IChromeBottomInset | undefined,
  isActive: boolean,
) {
  const isCollapsed = useIsChromeCollapsed(
    isActive ? inset?.progress : undefined,
  );
  if (!inset) {
    return undefined;
  }
  return isCollapsed ? inset.collapsed : inset.expanded;
}
