import { useCallback, useEffect, useMemo, useState } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

export const useWebviewRef = (
  webViewRef: IWebViewWrapperRef | null,
  navigationStateChangeEvent: any | null,
  onOpenNewUrl: (url: string) => void,
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

  const canGoBack = useCallback((): boolean => {
    if (webViewRef?.innerRef) {
      try {
        if (rnCanGoBack !== undefined) {
          return rnCanGoBack;
        }
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
        return webViewRef?.innerRef?.canGoBack();
      } catch (e) {
        console.log(e);
      }
    }
    return false;
  }, [rnCanGoBack, webViewRef?.innerRef]);

  const goBack = useCallback(() => {
    if (webViewRef?.innerRef) {
      try {
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        webViewRef?.innerRef?.goBack();
      } catch (e) {
        console.log(e);
      }
    }
  }, [webViewRef?.innerRef]);

  const canGoForward = useCallback((): boolean => {
    if (webViewRef?.innerRef) {
      try {
        if (rnCanGoForward !== undefined) {
          return rnCanGoForward;
        }

        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
        return webViewRef?.innerRef?.canGoForward();
      } catch (e) {
        console.log(e);
      }
    }
    return false;
  }, [rnCanGoForward, webViewRef?.innerRef]);

  const goForward = useCallback(() => {
    if (webViewRef?.innerRef) {
      try {
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        webViewRef?.innerRef?.goForward();
      } catch (e) {
        console.log(e);
      }
      return false;
    }
  }, [webViewRef?.innerRef]);

  const stopLoading = useCallback(() => {
    if (webViewRef?.innerRef) {
      try {
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        webViewRef?.innerRef?.stop();
      } catch (e) {
        console.log(e);
      }
    }
  }, [webViewRef?.innerRef]);

  return useMemo(
    () => ({
      canGoBack,
      goBack,
      canGoForward,
      goForward,
      stopLoading,
      loading: isLoading,
      title: currentTitle,
      url: currentUrl,
      favicon: currentFavicon,
    }),
    [
      canGoBack,
      canGoForward,
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
