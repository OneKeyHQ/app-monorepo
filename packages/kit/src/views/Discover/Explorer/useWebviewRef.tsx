import { useCallback, useEffect, useMemo, useState } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

    if (platformEnv.isNative) {
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
    }
  }, [navigationStateChangeEvent]);

  useEffect(() => {
    if (platformEnv.isDesktop) {
      try {
        // Electron Webview

        const electronWebView = webViewRef?.innerRef as IElectronWebView;
        if (!electronWebView) {
          return;
        }
        const handleMessage = () => {
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          setCurrentTitle(webViewRef?.innerRef?.getTitle());

          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          setCurrentUrl(webViewRef?.innerRef?.getURL());
          setLoading(false);
        };

        const handleStartLoadingMessage = () => {
          setCurrentTitle(undefined);
          setCurrentUrl(undefined);
          setLoading(true);
        };

        const handleFaviconMessage = (event: any) => {
          // console.log('page-favicon-updated:', event);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (event.favicons && event.favicons.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            setCurrentFavicon(event.favicons[0]);
          }
        };

        const handleLoadFailMessage = (event: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (event.errorCode !== -3) {
            setLoading(false);
          }
        };
        const handleLoadStopMessage = () => {
          setLoading(false);
        };
        const handleNewWindowMessage = (e: Event) => {
          console.log('====: handleNewWindowMessage new-window:', e);

          // @ts-expect-error
          const { url } = e;
          if (url) {
            onOpenNewUrl(url);
          }
        };

        console.log('RN WebView addEventListener', !!electronWebView);

        electronWebView.addEventListener(
          'did-start-loading',
          handleStartLoadingMessage,
        );
        electronWebView.addEventListener(
          'page-favicon-updated',
          handleFaviconMessage,
        );
        electronWebView.addEventListener('did-finish-load', handleMessage);
        electronWebView.addEventListener(
          'did-stop-loading',
          handleLoadStopMessage,
        );
        electronWebView.addEventListener(
          'did-fail-load',
          handleLoadFailMessage,
        );
        electronWebView.addEventListener('new-window', handleNewWindowMessage);

        return () => {
          electronWebView.removeEventListener(
            'did-start-loading',
            handleStartLoadingMessage,
          );
          electronWebView.removeEventListener(
            'page-favicon-updated',
            handleFaviconMessage,
          );
          electronWebView.removeEventListener('did-finish-load', handleMessage);
          electronWebView.removeEventListener(
            'did-fail-load',
            handleLoadFailMessage,
          );
          electronWebView.removeEventListener(
            'did-stop-loading',
            handleLoadStopMessage,
          );
          electronWebView.removeEventListener(
            'new-window',
            handleNewWindowMessage,
          );
        };
      } catch (error) {
        console.error(error);
      }
    }
  }, [webViewRef?.innerRef]);

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
