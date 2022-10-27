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
  const goBack = useCallback(() => {
    try {
      ref?.goBack();
      // eslint-disable-next-line no-empty
    } catch {}
  }, [ref]);

  const goForward = useCallback(() => {
    try {
      ref?.goForward();
      // eslint-disable-next-line no-empty
    } catch {}
  }, [ref]);

  const stopLoading = useCallback(() => {
    try {
      ref?.stopLoading();
      onNavigation({ loading: false });
      // eslint-disable-next-line no-empty
    } catch {}
  }, [onNavigation, ref]);

  useEffect(() => {
    if (navigationStateChangeEvent) {
      const { canGoBack, canGoForward, loading, title, url } =
        navigationStateChangeEvent;

      const isDeepLink = !url.startsWith('http') && url !== 'about:blank';
      if (isDeepLink) {
        stopLoading();
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
  }, [navigationStateChangeEvent, onNavigation, ref, stopLoading]);

  return {
    goBack,
    goForward,
    stopLoading,
  };
};
