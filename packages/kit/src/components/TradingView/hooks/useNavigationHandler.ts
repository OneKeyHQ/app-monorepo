import { useCallback, useMemo } from 'react';

import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IUseNavigationHandlerReturn {
  handleNavigation: (event: WebViewNavigation) => boolean;
  originWhitelist: string[];
}

function getUrlOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch (_error) {
    return undefined;
  }
}

export function isTradingViewNavigationAllowed({
  requestUrl,
  tradingViewUrl,
}: {
  requestUrl: string;
  tradingViewUrl: string;
}) {
  if (requestUrl === 'about:blank') {
    return true;
  }
  const tradingViewOrigin = getUrlOrigin(tradingViewUrl);
  if (!tradingViewOrigin) {
    return false;
  }
  return getUrlOrigin(requestUrl) === tradingViewOrigin;
}

export const useNavigationHandler = (
  tradingViewUrl: string,
): IUseNavigationHandlerReturn => {
  const originWhitelist = useMemo(() => {
    const tradingViewOrigin = getUrlOrigin(tradingViewUrl);
    return tradingViewOrigin ? [tradingViewOrigin] : [];
  }, [tradingViewUrl]);
  const handleNavigation = useCallback(
    (event: WebViewNavigation): boolean => {
      return isTradingViewNavigationAllowed({
        requestUrl: event.url,
        tradingViewUrl,
      });
    },
    [tradingViewUrl],
  );

  return { handleNavigation, originWhitelist };
};
