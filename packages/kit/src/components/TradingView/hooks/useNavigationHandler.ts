import { useCallback } from 'react';

import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IUseNavigationHandlerReturn {
  handleNavigation: (event: WebViewNavigation) => boolean;
}

/**
 * Custom hook for handling WebView navigation in TradingView.
 *
 * Tapping the chart's TradingView logo navigates to www.tradingview.com.
 * Block that redirect entirely (instead of opening it in an external browser),
 * since the jump is annoying on mobile. All other navigation is allowed.
 */
export const useNavigationHandler = (): IUseNavigationHandlerReturn => {
  const handleNavigation = useCallback((event: WebViewNavigation): boolean => {
    try {
      const requestUrl = new URL(event.url);
      if (requestUrl.hostname === 'www.tradingview.com') {
        return false;
      }
      return true;
    } catch (_error) {
      // If URL parsing fails, allow the request
      return true;
    }
  }, []);

  return { handleNavigation };
};
