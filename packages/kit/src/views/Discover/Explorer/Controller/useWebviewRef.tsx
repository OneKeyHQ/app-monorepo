import { useCallback, useEffect, useRef } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview/dist/useWebViewBridge';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnWebviewNavigation, webviewKeys } from '../explorerUtils';

import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

export function crossWebviewLoadUrl({
  wrapperRef,
  url,
  tabId,
}: {
  wrapperRef: IWebViewWrapperRef;
  url: string;
  tabId?: string;
}) {
  debugLogger.webview.info('crossWebviewLoadUrl >>>>', url);
  // loadURL: (url: string)
  if (platformEnv.isDesktop) {
    (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url);
  } else {
    // IWebViewWrapperRef has cross-platform loadURL()
    //    will trigger webview.onSrcChange props
    wrapperRef?.loadURL(url);
  }
  if (tabId) webviewKeys[tabId] = new Date().getTime().toString(10);
}

export const useWebviewRef = ({
  ref,
  wrapperRef,
  onNavigation,
  tabId,
}: {
  ref?: IElectronWebView;
  wrapperRef?: IWebViewWrapperRef | null;
  onNavigation: OnWebviewNavigation;
  tabId: string;
  navigationStateChangeEvent?: WebViewNavigation;
}) => {
  const isDomReady = useRef(false);
  useEffect(() => {
    if (platformEnv.isDesktop) {
      try {
        // Electron Webview
        if (!ref) {
          return;
        }
        const handleFinishLoading = () => onNavigation({ loading: false });
        const handleNavigation = ({
          url,
          isInPlace,
          isMainFrame,
        }: {
          url: string;
          isInPlace: boolean;
          isMainFrame: boolean;
        }) => {
          if (isMainFrame) {
            // TODO cycle loadUrl when did-start-navigation?
            const isInPlaceFinal = platformEnv.isDesktop ? true : isInPlace;
            onNavigation({
              url,
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              title: ref.getTitle(),
              isInPlace: isInPlaceFinal,
              canGoBack:
                isDomReady.current && // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                ref.canGoBack(),
              canGoForward:
                isDomReady.current && // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                ref.canGoForward(),
            });
          }
        };

        const handleDomReady = () => {
          isDomReady.current = true;
          // @ts-ignore
          ref.__domReady = true;
        };

        const handleStartLoadingMessage = () => onNavigation({ loading: true });

        const handleTitleMessage = ({ title }: { title: string }) => {
          if (title) {
            onNavigation({
              title,
            });
          }
        };

        const handleFaviconMessage = ({ favicons }: { favicons: string[] }) => {
          // console.log('page-favicon-updated:', event);
          if (favicons.length > 0) {
            onNavigation({
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              favicon: favicons[0],
            });
          }
        };

        const handleLoadFailMessage = handleFinishLoading;
        const handleLoadStopMessage = handleFinishLoading;
        const handleNewWindowMessage = (e: Event) => {
          // @ts-expect-error
          const { url } = e;
          if (url) {
            onNavigation({ url, isNewWindow: true });
          }
        };
        ref.addEventListener('did-start-loading', handleStartLoadingMessage);
        ref.addEventListener('did-start-navigation', handleNavigation);
        ref.addEventListener('page-title-updated', handleTitleMessage);
        ref.addEventListener('page-favicon-updated', handleFaviconMessage);
        ref.addEventListener('did-finish-load', handleFinishLoading);
        ref.addEventListener('did-stop-loading', handleLoadStopMessage);
        ref.addEventListener('did-fail-load', handleLoadFailMessage);
        ref.addEventListener('new-window', handleNewWindowMessage);
        ref.addEventListener('dom-ready', handleDomReady);

        return () => {
          ref.removeEventListener(
            'did-start-loading',
            handleStartLoadingMessage,
          );
          ref.removeEventListener('page-title-updated', handleTitleMessage);
          ref.removeEventListener('page-favicon-updated', handleFaviconMessage);
          ref.removeEventListener('did-finish-load', handleFinishLoading);
          ref.removeEventListener('did-start-navigation', handleNavigation);
          ref.removeEventListener('did-stop-loading', handleLoadStopMessage);
          ref.removeEventListener('did-fail-load', handleLoadFailMessage);
          ref.removeEventListener('new-window', handleNewWindowMessage);
          ref.removeEventListener('dom-ready', handleDomReady);
        };
      } catch (error) {
        console.error(error);
      }
    }
  }, [ref, onNavigation]);

  const goBack = useCallback(() => {
    if (isDomReady.current) {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      ref?.goBack();
    }
  }, [ref]);

  const goForward = useCallback(() => {
    if (isDomReady.current) {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      ref?.goForward();
    }
  }, [ref]);

  const stopLoading = useCallback(() => {
    if (isDomReady.current) {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      ref?.stop();
    }
  }, [ref]);

  const reload = useCallback(() => {
    // cross-platform reload()
    wrapperRef?.reload();
  }, [wrapperRef]);

  const loadURL = useCallback(
    (url: string) => {
      if (wrapperRef)
        crossWebviewLoadUrl({
          wrapperRef,
          url,
          tabId,
        });
    },
    [tabId, wrapperRef],
  );

  return {
    goBack,
    goForward,
    stopLoading,
    loadURL,
    reload,
  };
};
