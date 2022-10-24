import { useCallback, useEffect } from 'react';

import { Linking } from 'react-native';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import { OnWebviewNavigation } from '../explorerUtils';

import type { WebView } from 'react-native-webview';

export const useWebviewRef = ({
  ref,
  navigationStateChangeEvent,
  onNavigation,
}: {
  ref?: WebView;
  navigationStateChangeEvent?: WebViewNavigation;
  onNavigation: OnWebviewNavigation;
}) => {
  useEffect(() => {
    if (navigationStateChangeEvent) {
      const { canGoBack, canGoForward, loading, title, url } =
        navigationStateChangeEvent;

      const isDeepLink = !url.startsWith('http') && url !== 'about:blank';
      if (isDeepLink) {
        ref?.stopLoading();
        // canOpenURL may need additional config on android 11+
        // https://github.com/facebook/react-native/issues/32311#issuecomment-933568611
        // so just try open directly
        Linking.openURL(url).catch();
        return;
      }
      if (loading) {
        onNavigation({ url, title, canGoBack, canGoForward, loading });
      } else {
        onNavigation({ title, canGoBack, canGoForward, loading });
      }
    }
  }, [navigationStateChangeEvent, onNavigation, ref]);

  const goBack = useCallback(() => {
    ref?.goBack();
  }, [ref]);

  const goForward = useCallback(() => {
    ref?.goForward();
  }, [ref]);

  const stopLoading = useCallback(() => {
    ref?.stopLoading();
    onNavigation({ loading: false });
  }, [onNavigation, ref]);

  return {
    goBack,
    goForward,
    stopLoading,
  };
};
