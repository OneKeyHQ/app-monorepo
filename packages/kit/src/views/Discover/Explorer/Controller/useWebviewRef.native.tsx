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
      // console.log('navigationStateChangeEvent', navigationStateChangeEvent);
      try {
        const { canGoBack, canGoForward, loading, title, url } =
          navigationStateChangeEvent;
        const urlObj = new URL(url);
        const favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
        onNavigation({ url, title, favicon, canGoBack, canGoForward, loading });
      } catch (e) {
        // console.log(e);
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
