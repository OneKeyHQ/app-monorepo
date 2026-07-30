import { useCallback, useEffect, useRef } from 'react';

import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import {
  restoreBrowserWebviewsOnRoute,
  throttleBrowserWebviewsOffRoute,
} from '@onekeyhq/kit/src/views/Discovery/utils/browserOffRouteThrottle';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

// Grace period before throttling. Long enough that passing through another tab
// (or a modal briefly covering the browser) does not churn every live WebView,
// short enough that walking away from the browser stops paying for it quickly.
const OFF_ROUTE_THROTTLE_DELAY_MS = 20_000;

/**
 * Desktop only. Tells every live DApp WebView it is hidden while the user is
 * away from the browser route, and undoes that on return.
 *
 * Mounted globally rather than inside the browser page: the page itself is a
 * tab screen, so an effect living there could not observe the whole time the
 * user spends elsewhere.
 *
 * Restoring is deliberately immediate (no delay) so the page has the longest
 * possible head start to catch up before the user's eyes land on it.
 */
function BrowserOffRouteThrottleContainer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingThrottle = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Do NOT wrap in useCallback — useListenTabFocusState documents that.
  const handleBrowserFocusState = (isFocus: boolean) => {
    if (isFocus) {
      clearPendingThrottle();
      restoreBrowserWebviewsOnRoute();
      return;
    }
    if (timerRef.current) {
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      throttleBrowserWebviewsOffRoute();
    }, OFF_ROUTE_THROTTLE_DELAY_MS);
  };

  // A modal covering the browser still leaves the page visible underneath, so
  // isHideByModal is intentionally ignored here — only leaving the route counts.
  useListenTabFocusState(ETabRoutes.MultiTabBrowser, handleBrowserFocusState);

  useEffect(() => clearPendingThrottle, [clearPendingThrottle]);

  return null;
}

export function BrowserOffRouteThrottleContainerGate() {
  if (!platformEnv.isDesktop) {
    return null;
  }
  return <BrowserOffRouteThrottleContainer />;
}
