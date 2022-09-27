import { useCallback, useEffect, useState } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnWebviewNavigation } from '../explorerUtils';

import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

export const useWebviewRef = ({
  ref,
  onNavigation,
}: {
  ref?: IElectronWebView;
  onNavigation: OnWebviewNavigation;
  navigationStateChangeEvent?: WebViewNavigation;
}) => {
  const [loading, setLoading] = useState(false);
  const [isDomReady, setIsDomReady] = useState(false);
  useEffect(() => {
    if (platformEnv.isDesktop) {
      try {
        // Electron Webview
        if (!ref) {
          return;
        }
        const handleFinishLoading = () => setLoading(false);
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
            onNavigation({
              url,
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              title: ref.getTitle(),
              isInPlace,
            });
          }
        };

        const handleDomReady = () => setIsDomReady(true);

        const handleStartLoadingMessage = () => setLoading(true);

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

  const canGoBack =
    isDomReady && // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
    ref?.canGoBack();

  const goBack = useCallback(() => {
    if (isDomReady) {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      ref?.goBack();
    }
  }, [isDomReady, ref]);

  const canGoForward =
    isDomReady && // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
    ref?.canGoForward();

  const goForward = useCallback(() => {
    if (isDomReady) {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      ref?.goForward();
    }
  }, [isDomReady, ref]);

  const stopLoading = useCallback(() => {
    if (isDomReady) {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      ref?.stop();
      setLoading(false);
    }
  }, [isDomReady, ref]);

  return {
    canGoBack,
    goBack,
    canGoForward,
    goForward,
    stopLoading,
    loading,
    isDomReady,
  };
};
