import { useCallback, useEffect } from 'react';

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
      if (loading) {
        onNavigation({ url, title, canGoBack, canGoForward, loading });
      } else {
        onNavigation({ title, canGoBack, canGoForward, loading });
      }
    }
  }, [navigationStateChangeEvent, onNavigation]);

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
