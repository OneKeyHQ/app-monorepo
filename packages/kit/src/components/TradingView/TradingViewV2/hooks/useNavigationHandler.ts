import { useCallback } from 'react';

import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IUseNavigationHandlerReturn {
  handleNavigation: (event: WebViewNavigation) => boolean;
}

/**
 * Custom hook for handling WebView navigation in TradingView
 * @returns Navigation handler function that redirects external URLs to system browser
 */
export const useNavigationHandler = (): IUseNavigationHandlerReturn => {
  const handleNavigation = useCallback((event: WebViewNavigation): boolean => {
    try {
      const requestUrl = new URL(event.url);
      const isBlockedTradingViewUrl =
        requestUrl.hostname === 'www.tradingview.com';

      if (isBlockedTradingViewUrl) {
        console.log(
          'Blocked navigation to www.tradingview.com, opening in external browser:',
          event.url,
        );
        // Open the blocked URL in external browser
        openUrlUtils.openUrlExternal(event.url);
        return false;
      }

      return true;
    } catch (error) {
      // If URL parsing fails, allow the request
      console.log('Failed to parse URL, allowing navigation:', event.url);
      return true;
    }
  }, []);

  return { handleNavigation };
};
