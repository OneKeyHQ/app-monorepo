import { useCallback, useEffect, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { batch } from 'react-redux';

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
  const [rnCanGoBack, setRNCanGoBack] = useState<boolean>(false);
  const [rnCanGoForward, setRNCanGoForward] = useState<boolean>(false);
  const [isLoading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (navigationStateChangeEvent) {
      // console.log('navigationStateChangeEvent', navigationStateChangeEvent);
      try {
        const { canGoBack, canGoForward, loading, title, url } =
          navigationStateChangeEvent;

        batch(() => {
          setRNCanGoBack(canGoBack);
          setRNCanGoForward(canGoForward);
          setLoading(loading);
        });
        const urlObj = new URL(url);
        const favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
        if (loading) onNavigation({ url, title, favicon });
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
  }, [ref]);

  return {
    canGoBack: rnCanGoBack,
    goBack,
    canGoForward: rnCanGoForward,
    goForward,
    stopLoading,
    loading: isLoading,
  };
};
