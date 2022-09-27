import { useCallback, useEffect, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { batch } from 'react-redux';

import type { WebView } from 'react-native-webview';

export const useWebviewRef = ({
  ref,
  navigationStateChangeEvent,
}: {
  ref?: WebView;
  navigationStateChangeEvent?: WebViewNavigation;
}) => {
  const [rnCanGoBack, setRNCanGoBack] = useState<boolean>();
  const [rnCanGoForward, setRNCanGoForward] = useState<boolean>();
  const [currentTitle, setCurrentTitle] = useState<string>();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>();
  const [currentFavicon, setCurrentFavicon] = useState<string>();

  useEffect(() => {
    if (navigationStateChangeEvent) {
      try {
        const { canGoBack, canGoForward, loading, title, url } =
          navigationStateChangeEvent;

        batch(() => {
          setRNCanGoBack(canGoBack);
          setRNCanGoForward(canGoForward);
          setCurrentTitle(title);
          setCurrentUrl(url);
          setLoading(loading);
        });

        const urlObj = new URL(url);
        setCurrentFavicon(`${urlObj.protocol}//${urlObj.host}/favicon.ico`);
      } catch (e) {
        // console.log(e);
      }
    }
  }, [navigationStateChangeEvent]);

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
    title: currentTitle,
    url: currentUrl,
    favicon: currentFavicon,
  };
};
