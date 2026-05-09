import { useLayoutEffect, useMemo, useRef } from 'react';

import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { EPageType, Stack } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { MIN_SIDEBAR_WIDTH } from '@onekeyhq/components/src/utils/sidebar';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EWebViewRoutes } from '@onekeyhq/shared/src/routes';

import { webViewRouter } from './router';

/**
 * Disable pointer-events on the two react-navigation Card wrappers that sit
 * directly above our overlay on desktop. They default to pointerEvents=auto
 * and capture clicks in the sidebar passthrough column.
 *
 * Why we touch the DOM directly instead of fixing this at the screen-options
 * level: react-navigation's Card renders these inner Views with a hardcoded
 * `pointerEvents` based on focus state; `cardStyle` is a style-object so its
 * `pointerEvents` value is dropped by react-native-web (which only translates
 * `pointerEvents` from the prop, not from style). cardStyleInterpolator's
 * containerStyle has the same translation gap.
 *
 * Scope: targeted by our specific testID, only while WebView is mounted on
 * desktop, restored on unmount. CSS spec guarantees descendants with their
 * own `pointer-events: auto` (the WebView itself) keep receiving events even
 * when ancestors are `pointer-events: none`.
 */
function useDesktopOverlayParentPassthrough() {
  const restoreRef = useRef<Array<() => void>>([]);

  useLayoutEffect(() => {
    if (!platformEnv.isDesktop) return undefined;
    const node = document.querySelector(
      '[data-testid="webview-overlay-outer"]',
    );
    if (!(node instanceof HTMLElement)) return undefined;

    const restoreFns: Array<() => void> = [];
    let parent = node.parentElement;
    for (let i = 0; i < 2; i += 1) {
      if (!(parent instanceof HTMLElement)) break;
      const previous = parent.style.getPropertyValue('pointer-events');
      const previousPriority =
        parent.style.getPropertyPriority('pointer-events');
      const target = parent;
      target.style.setProperty('pointer-events', 'none', 'important');
      restoreFns.push(() => {
        if (previous) {
          target.style.setProperty(
            'pointer-events',
            previous,
            previousPriority,
          );
        } else {
          target.style.removeProperty('pointer-events');
        }
      });
      parent = parent.parentElement;
    }
    restoreRef.current = restoreFns;

    return () => {
      restoreFns.forEach((fn) => fn());
      restoreRef.current = [];
    };
  }, []);
}

export function WebViewNavigator() {
  useDesktopOverlayParentPassthrough();

  // OneKey's HeaderView computes its height as `52 + safeAreaInsets.top` on
  // web/desktop. The Electron app sets a non-zero top inset to clear the
  // macOS traffic-light strip — but our desktop overlay covers that strip on
  // purpose, so we don't want the extra room. Override the top inset to 0
  // just for this subtree on desktop. Native iOS/Android keep their normal
  // status-bar inset for the system UI.
  const insets = useSafeAreaInsets();
  const overlaySafeAreaInsets = useMemo(
    () => ({ ...insets, top: 0 }),
    [insets],
  );

  const baseNavigator = (
    <RootModalNavigator<EWebViewRoutes>
      config={webViewRouter}
      pageType={EPageType.webView}
    />
  );
  const navigator = platformEnv.isDesktop ? (
    <SafeAreaInsetsContext.Provider value={overlaySafeAreaInsets}>
      {baseNavigator}
    </SafeAreaInsetsContext.Provider>
  ) : (
    baseNavigator
  );
  if (platformEnv.isDesktop) {
    // Outer wrapper covers full screen with pe=box-none so empty area
    // (left of sidebar inset) lets clicks reach the underlying Main route.
    // Inner wrapper is absolute-positioned starting at sidebar width so the
    // WebView content occupies only the main-content area.
    //
    // Inset is the regular "app page" surface — bg=$bgSidebar matches the
    // sidebar's background so the navbar visually merges with it (one-piece
    // app chrome). The WebView body itself gets the rounded-card look inside
    // WebViewPage. Sits flush to the top so the close button reaches the
    // top-left corner; macOS traffic-light buttons render on the OS layer
    // above this anyway.
    return (
      <Stack flex={1} pointerEvents="box-none" testID="webview-overlay-outer">
        <Stack
          position="absolute"
          top={0}
          bottom={0}
          left={MIN_SIDEBAR_WIDTH}
          right={0}
          bg="$bgSidebar"
          testID="webview-overlay-inset"
        >
          {navigator}
        </Stack>
      </Stack>
    );
  }
  return navigator;
}
