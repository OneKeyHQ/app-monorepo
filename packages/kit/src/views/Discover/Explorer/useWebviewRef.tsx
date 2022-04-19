import { useEffect, useState } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useWebviewRef = (
  webViewRef: IWebViewWrapperRef | null,
  navigationStateChangeEvent: any | null,
) => {
  const [rnCanGoBack, setRNCanGoBack] = useState<boolean>();
  const [rnCanGoForward, setRNCanGoForward] = useState<boolean>();
  const [currentTitle, setCurrentTitle] = useState<string>();
  const [currentUrl, setCurrentUrl] = useState<string>();
  const [currentFavicon, setCurrentFavicon] = useState<string>();

  useEffect(() => {
    // RN Webview

    if (platformEnv.isNative) {
      try {
        const { canGoBack, canGoForward, title, url } =
          navigationStateChangeEvent;

        setRNCanGoBack(canGoBack);
        setRNCanGoForward(canGoForward);
        setCurrentTitle(title);
        setCurrentUrl(url);

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
        const handleMessage = () => {
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          setCurrentTitle(webViewRef?.innerRef?.getTitle());

          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          setCurrentUrl(webViewRef?.innerRef?.getURL());
        };

        const handleStartLoadingMessage = () => {
          setCurrentTitle(undefined);

          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          setCurrentUrl(webViewRef?.innerRef?.getURL());
        };

        const handleFaviconMessage = (event: any) => {
          // console.log('page-favicon-updated:', event);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (event.favicons && event.favicons.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            setCurrentFavicon(event.favicons[0]);
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
        };
      } catch (error) {
        console.log(error);
      }
    }
  }, [webViewRef?.innerRef]);

  const canGoBack = (): boolean => {
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
  };

  const goBack = () => {
    if (webViewRef?.innerRef) {
      try {
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        webViewRef?.innerRef?.goBack();
      } catch (e) {
        console.log(e);
      }
    }
  };

  const canGoForward = (): boolean => {
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
  };

  const goForward = () => {
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
  };

  return {
    canGoBack,
    goBack,
    canGoForward,
    goForward,
    title: currentTitle,
    url: currentUrl,
    favicon: currentFavicon,
  };
};
