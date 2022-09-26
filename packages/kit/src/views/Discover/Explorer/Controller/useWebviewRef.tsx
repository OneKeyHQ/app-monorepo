import { useCallback, useEffect, useState } from 'react';

import { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import { batch } from 'react-redux';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useWebviewRef = ({
  ref,
  onNavigation,
}: {
  ref?: IElectronWebView;
  onNavigation: ({
    url,
    title,
    favicon,
    isInPlace,
    isNewWindow,
  }: {
    url: string;
    title?: string;
    favicon?: string;
    isInPlace?: boolean;
    isNewWindow?: boolean;
  }) => void;
}) => {
  useEffect(() => {
    if (platformEnv.isDesktop) {
      try {
        // Electron Webview
        if (!ref) {
          return;
        }
        const handleFinishLoading = () => {
          // onNavigation({
          //   url: ref.getURL(),
          //   // @ts-ignore
          //   // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          //   title: ref.getTitle(),
          // });
        };
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

        const handleStartLoadingMessage = () =>
          batch(() => {
            // setCurrentTitle(undefined);
            // setCurrentUrl(undefined);
            // setLoading(true);
          });

        const handleTitleMessage = ({ title }: { title: string }) => {
          if (title) {
            onNavigation({
              url: ref.getURL(),
              title,
            });
          }
        };

        const handleFaviconMessage = ({ favicons }: { favicons: string[] }) => {
          // console.log('page-favicon-updated:', event);
          if (favicons.length > 0) {
            onNavigation({
              url: ref.getURL(),
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              favicon: favicons[0],
            });
          }
        };

        const handleLoadFailMessage = (event: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (event.errorCode !== -3) {
            // setLoading(false);
          }
        };
        const handleLoadStopMessage = () => {
          // setLoading(false);
        };
        const handleNewWindowMessage = (e: Event) => {
          // @ts-expect-error
          const { url } = e;
          if (url) {
            onNavigation({ url, isNewWindow: true });
          }
        };
        ref.addEventListener('did-start-loading', handleStartLoadingMessage);
        ref.addEventListener('page-title-updated', handleTitleMessage);
        ref.addEventListener('page-favicon-updated', handleFaviconMessage);
        ref.addEventListener('did-finish-load', handleFinishLoading);
        ref.addEventListener('did-start-navigation', handleNavigation);
        ref.addEventListener('did-stop-loading', handleLoadStopMessage);
        ref.addEventListener('did-fail-load', handleLoadFailMessage);
        ref.addEventListener('new-window', handleNewWindowMessage);

        return () => {
          ref.removeEventListener(
            'did-start-loading',
            handleStartLoadingMessage,
          );
          ref.removeEventListener('page-title-updated', handleTitleMessage);
          ref.removeEventListener('page-favicon-updated', handleFaviconMessage);
          ref.removeEventListener('did-finish-load', handleFinishLoading);
          ref.removeEventListener('did-start-navigation', handleNavigation);
          ref.removeEventListener('did-fail-load', handleLoadFailMessage);
          ref.removeEventListener('did-stop-loading', handleLoadStopMessage);
          ref.removeEventListener('new-window', handleNewWindowMessage);
        };
      } catch (error) {
        console.error(error);
      }
    }
  }, [ref, onNavigation]);

  const canGoBack = useCallback(
    (): boolean =>
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
      ref?.canGoBack(),
    [ref],
  );

  const goBack = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    ref?.goBack();
  }, [ref]);

  const canGoForward = useCallback(
    (): boolean =>
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-call
      ref?.canGoForward(),
    [ref],
  );

  const goForward = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    ref?.goForward();
  }, [ref]);

  const stopLoading = useCallback(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    ref?.stop();
  }, [ref]);

  return {
    canGoBack,
    goBack,
    canGoForward,
    goForward,
    stopLoading,
  };
};
