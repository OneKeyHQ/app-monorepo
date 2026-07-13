import { useLayoutEffect, useRef } from 'react';

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
 * Why we touch the DOM directly: react-navigation's Card sets `pointerEvents`
 * on those Views via prop (focus-state-aware); `cardStyle` is style-only and
 * react-native-web ignores `pointerEvents` from style. Targeted to our
 * specific testID, restored on unmount.
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

  const navigator = (
    <RootModalNavigator<EWebViewRoutes>
      config={webViewRouter}
      pageType={EPageType.webView}
    />
  );
  if (platformEnv.isDesktop) {
    // Outer wrapper covers full screen with pe=box-none so empty area
    // (left of sidebar inset) lets clicks reach the underlying Main route.
    // Inner wrapper is absolute-positioned starting at sidebar width.
    return (
      <Stack flex={1} pointerEvents="box-none" testID="webview-overlay-outer">
        <Stack
          position="absolute"
          top={0}
          bottom={0}
          left={MIN_SIDEBAR_WIDTH}
          right={0}
          testID="webview-overlay-inset"
        >
          {navigator}
        </Stack>
      </Stack>
    );
  }
  return navigator;
}
