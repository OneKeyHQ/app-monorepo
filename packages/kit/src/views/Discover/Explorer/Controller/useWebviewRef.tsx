import { useCallback, useEffect, useMemo, useState } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { batch } from 'react-redux';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useWebviewRef = (
  webViewRef?: IWebViewWrapperRef,
  navigationStateChangeEvent?: WebViewNavigation,
  onOpenNewUrl?: (url: string) => void,
) => {
  const electronWebView = webViewRef?.innerRef as IElectronWebView;
  const [currentTitle, setCurrentTitle] = useState<string>();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>();
  const [currentFavicon, setCurrentFavicon] = useState<string>();

  useEffect(() => {
    if (platformEnv.isDesktop) {
      try {
        // Electron Webview
        if (!electronWebView) {
          return;
        }
        const handleMessage = () =>
          batch(() => {
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            setCurrentTitle(electronWebView?.getTitle());

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            setCurrentUrl(electronWebView?.getURL());
            setLoading(false);
          });

        const handleStartLoadingMessage = () =>
          batch(() => {
            setCurrentTitle(undefined);
            setCurrentUrl(undefined);
            setLoading(true);
          });

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
          console.log({ e });
          // @ts-expect-error
          const { url } = e;
          if (url) {
            onOpenNewUrl?.(url);
          }
        };
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
  }, [onOpenNewUrl, electronWebView]);

  const canGoBack = useCallback(
    (): boolean =>
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
      electronWebView?.canGoBack(),
    [electronWebView],
  );

  const goBack = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    electronWebView?.goBack();
  }, [electronWebView]);

  const canGoForward = useCallback(
    (): boolean =>
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
      electronWebView?.canGoForward(),
    [electronWebView],
  );

  const goForward = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    electronWebView?.goForward();
  }, [electronWebView]);

  const stopLoading = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    electronWebView?.stop();
  }, [electronWebView]);

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
