import { useCallback, useEffect, useMemo, useState } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

export const useWebviewRef = (
  webViewRef?: IWebViewWrapperRef,
  navigationStateChangeEvent?: WebViewNavigation,
  onOpenNewUrl?: (url: string) => void,
) => {
  const [rnCanGoBack, setRNCanGoBack] = useState<boolean>();
  const [rnCanGoForward, setRNCanGoForward] = useState<boolean>();
  const [currentTitle, setCurrentTitle] = useState<string>();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>();
  const [currentFavicon, setCurrentFavicon] = useState<string>();

  useEffect(() => {
    // RN Webview
    try {
      const { canGoBack, canGoForward, loading, title, url } =
        navigationStateChangeEvent;

      setRNCanGoBack(canGoBack);
      setRNCanGoForward(canGoForward);
      setCurrentTitle(title);
      setCurrentUrl(url);
      setLoading(loading);

      const urlObj = new URL(url);
      setCurrentFavicon(`${urlObj.protocol}//${urlObj.host}/favicon.ico`);
    } catch (e) {
      console.log(e);
    }
  }, [navigationStateChangeEvent]);

  const goBack = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    webViewRef?.innerRef?.goBack();
  }, [webViewRef?.innerRef]);

  const goForward = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    webViewRef?.innerRef?.goForward();
  }, [webViewRef?.innerRef]);

  const stopLoading = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    webViewRef?.innerRef?.stop();
  }, [webViewRef?.innerRef]);

  return useMemo(
    () => ({
      // canGoBack,
      goBack,
      // canGoForward,
      goForward,
      stopLoading,
      loading: isLoading,
      title: currentTitle,
      url: currentUrl,
      favicon: currentFavicon,
    }),
    [
      isLoading,
      currentTitle,
      currentUrl,
      currentFavicon,
      goBack,
      goForward,
      stopLoading,
    ],
  );
};
