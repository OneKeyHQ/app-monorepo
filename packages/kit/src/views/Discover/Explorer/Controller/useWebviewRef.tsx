import { useCallback, useEffect, useRef } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnWebviewNavigation } from '../explorerUtils';

import { getWebviewWrapperRef } from './getWebviewWrapperRef';

import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

export function crossWebviewLoadUrl({
  url,
  tabId,
}: {
  url: string;
  tabId?: string;
}) {
  const wrapperRef = getWebviewWrapperRef({
    tabId,
  });
  debugLogger.webview.info('crossWebviewLoadUrl >>>>', url);
  if (platformEnv.isDesktop) {
    // TODO wait wrapperRef, innerRef, dom-ready then loadURL
    (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url);
  } else {
    // IWebViewWrapperRef has cross-platform loadURL()
    //    will trigger webview.onSrcChange props
    wrapperRef?.loadURL(url);
  }
}

export const useWebviewRef = ({
  ref,
  onNavigation,
  tabId,
}: {
  ref?: IElectronWebView;
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
        const getNavStatusInfo = () => {
          if (!ref || !isDomReady.current) {
            return undefined;
          }
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const title = ref.getTitle();
          const canGoBack =
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            ref.canGoBack();
          const canGoForward =
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            ref.canGoForward();
          return {
            title,
            canGoBack,
            canGoForward,
          };
        };
        const handleFinishLoading = () =>
          onNavigation({
            // loading
            loading: false,
            ...getNavStatusInfo(),
          });
        // did-start-navigation
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
              loading: true,
              isInPlace: isInPlaceFinal,
              ...getNavStatusInfo(),
            });
          }
        };

        const handleDomReady = () => {
          isDomReady.current = true;
          // @ts-ignore
          ref.__domReady = true;
        };

        const handleStartLoadingMessage = () =>
          onNavigation({
            // loading
            loading: true,
            ...getNavStatusInfo(),
          });

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
    const wrapperRef = getWebviewWrapperRef({
      tabId,
    });
    // cross-platform reload()
    wrapperRef?.reload();
  }, [tabId]);

  const loadURL = useCallback(
    (url: string) => {
      crossWebviewLoadUrl({
        url,
        tabId,
      });
    },
    [tabId],
  );

  return {
    goBack,
    goForward,
    stopLoading,
    loadURL,
    reload,
  };
};
