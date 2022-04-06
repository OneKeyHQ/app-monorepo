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
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // RN Webview
    console.log('RN Webview');
    if (platformEnv.isNative) {
      try {
        const { canGoBack, canGoForward, title, url } =
          navigationStateChangeEvent;
        console.log('Electron Webview onNavigationStateChange', {
          canGoBack,
          canGoForward,
          title,
          url,
        });
        setRNCanGoBack(canGoBack);
        setRNCanGoForward(canGoForward);
        setCurrentTitle(title);
        setCurrentUrl(url);
      } catch (e) {
        console.log(e);
      }
    }
  }, [navigationStateChangeEvent]);

  useEffect(() => {
    if (platformEnv.isDesktop) {
      try {
        // Electron Webview
        console.log('Electron Webview');

        const electronWebView = webViewRef?.innerRef as IElectronWebView;
        const handleMessage = (event: any) => {
          console.log('did-finish-load event:', event);
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          setCurrentTitle(webViewRef?.innerRef?.getTitle());

          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          setCurrentUrl(webViewRef?.innerRef?.getURL());
        };

        console.log('RN WebView addEventListener', !!electronWebView);

        electronWebView.addEventListener('did-finish-load', handleMessage);
        return () => {
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
  };
};
