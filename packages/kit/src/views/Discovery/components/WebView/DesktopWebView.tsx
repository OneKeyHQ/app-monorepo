/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react/no-unknown-property */
import type { ComponentProps, Ref } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { consts } from '@onekeyfe/cross-inpage-provider-core';
import { JsBridgeDesktopHost } from '@onekeyfe/onekey-cross-webview';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import { checkOneKeyCardGoogleOauthUrl } from '@onekeyhq/shared/src/utils/uriUtils';

import ErrorView from './ErrorView';

import type {
  IElectronWebView,
  IElectronWebViewEvents,
  IInpageProviderWebViewProps,
} from './types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type {
  DidFailLoadEvent,
  DidStartNavigationEvent,
  Event,
  LoadURLOptions,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
} from 'electron';

export type {
  DidFailLoadEvent,
  DidStartNavigationEvent,
  Event,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
};

const isDev = process.env.NODE_ENV !== 'production';

function usePreloadJsUrl() {
  const { preloadJsUrl } = window.ONEKEY_DESKTOP_GLOBALS ?? {};
  useEffect(() => {
    if (preloadJsUrl) {
      return;
    }
    const timer = setTimeout(() => {
      if (!preloadJsUrl) {
        console.error(`Webview render failed:
      Please send messages of channel SET_ONEKEY_DESKTOP_GLOBALS at app start
      `);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [preloadJsUrl]);
  return preloadJsUrl as string;
}

// Used for webview type referencing
const WEBVIEW_TAG = 'webview';

const DesktopWebView = forwardRef(
  (
    {
      src,
      style,
      receiveHandler,
      allowpopups,
      onSrcChange,
      onDidStartLoading,
      onDidStartNavigation,
      onDidFinishLoad,
      onDidStopLoading,
      onDidFailLoad,
      onPageTitleUpdated,
      onPageFaviconUpdated,
      // @ts-expect-error
      onNewWindow,
      onDomReady,
      ...props
    }: ComponentProps<typeof WEBVIEW_TAG> &
      IElectronWebViewEvents &
      IInpageProviderWebViewProps,
    ref: any,
  ) => {
    const [isWebviewReady, setIsWebviewReady] = useState(false);
    const webviewRef = useRef<IElectronWebView | null>(null);
    const [devToolsAtLeft, setDevToolsAtLeft] = useState(false);

    const [desktopLoadError, setDesktopLoadError] = useState(false);

    // Register event listeners
    useEffect(() => {
      const webview = webviewRef.current;

      if (!webview) {
        return;
      }

      try {
        const checkGoogleOauth = (checkUrl: string) => {
          try {
            if (checkOneKeyCardGoogleOauthUrl({ url: checkUrl })) {
              const originUA = webview.getUserAgent();
              const updatedUserAgent = originUA.replace(
                / Electron\/[\d.]+/,
                '',
              );
              webview.setUserAgent(updatedUserAgent);
            }
          } catch (e) {
            // debugLogger.webview.error('handleNavigation', e);
            console.error(e);
          }
        };

        const innerHandleDidFailLoad = (event: any) => {
          if (event.errorCode !== -3) {
            // TODO iframe error also show ErrorView
            //      testing www.163.com
            if (event.isMainFrame) {
              setDesktopLoadError(true);
            }
          }
          onDidFailLoad?.(event);
        };

        const innerHandleDidStartNavigationNavigation = (
          event: DidStartNavigationEvent,
        ) => {
          const { isMainFrame, url } = event ?? {};
          if (isMainFrame) {
            setDesktopLoadError(false);
          }
          checkGoogleOauth(url);
          onDidStartNavigation?.(event);
        };

        webview.addEventListener('did-start-loading', onDidStartLoading);
        webview.addEventListener(
          'did-start-navigation',
          innerHandleDidStartNavigationNavigation,
        );
        webview.addEventListener('did-finish-load', onDidFinishLoad);
        webview.addEventListener('did-stop-loading', onDidStopLoading);
        webview.addEventListener('did-fail-load', innerHandleDidFailLoad);
        webview.addEventListener('page-title-updated', onPageTitleUpdated);
        webview.addEventListener('page-favicon-updated', onPageFaviconUpdated);
        webview.addEventListener('new-window', onNewWindow);
        webview.addEventListener('dom-ready', onDomReady);

        return () => {
          webview.removeEventListener('did-start-loading', onDidStartLoading);
          webview.removeEventListener(
            'did-start-navigation',
            innerHandleDidStartNavigationNavigation,
          );
          webview.removeEventListener('did-finish-load', onDidFinishLoad);
          webview.removeEventListener('did-stop-loading', onDidStopLoading);
          webview.removeEventListener('did-fail-load', innerHandleDidFailLoad);
          webview.removeEventListener('page-title-updated', onPageTitleUpdated);
          webview.removeEventListener(
            'page-favicon-updated',
            onPageFaviconUpdated,
          );
          webview.removeEventListener('new-window', onNewWindow);
          webview.removeEventListener('dom-ready', onDomReady);
        };
      } catch (error) {
        console.error(error);
      }
    }, [
      onDidFailLoad,
      onDidFinishLoad,
      onDidStartLoading,
      onDidStopLoading,
      onDomReady,
      onNewWindow,
      onPageFaviconUpdated,
      onPageTitleUpdated,
      onDidStartNavigation,
    ]);
    if (isDev && props.preload) {
      console.warn(
        'DesktopWebView:  custom preload url may disable built-in injected function',
      );
    }

    useEffect(
      () => () => {
        // not working, ref is null after unmount
        webviewRef.current?.closeDevTools();
      },
      [],
    );

    // TODO extract to hooks
    const jsBridgeHost = useMemo(
      () =>
        new JsBridgeDesktopHost({
          webviewRef,
          receiveHandler,
        }),
      [receiveHandler],
    );

    useImperativeHandle(ref as Ref<unknown>, (): IWebViewWrapperRef => {
      const wrapper = {
        innerRef: webviewRef.current,
        jsBridge: jsBridgeHost,
        reload: () => webviewRef.current?.reload(),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        loadURL: (url: string, options?: LoadURLOptions) => {
          if (onSrcChange) {
            onSrcChange(url);
          } else {
            webviewRef.current?.loadURL(url);
          }
        },
      };
      jsBridgeHost.webviewWrapper = wrapper;
      return wrapper;
    });

    const initWebviewByRef = useCallback(($ref: any) => {
      webviewRef.current = $ref;
      setIsWebviewReady(true);
    }, []);

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isWebviewReady) {
        return;
      }

      // only enable message for current focused webview
      jsBridgeHost.globalOnMessageEnabled = true;
      // connect background jsBridge
      backgroundApiProxy.connectBridge(jsBridgeHost);

      const handleMessage = async (event: {
        channel: string;
        args: Array<string>;
        target: IElectronWebView;
      }) => {
        if (event.channel === consts.JS_BRIDGE_MESSAGE_IPC_CHANNEL) {
          const data: string = event?.args?.[0];
          let originInRequest = '';
          let origin = '';
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            originInRequest = JSON.parse(data)?.origin as string;
            await waitForDataLoaded({
              wait: 600,
              logName: 'DesktopWebView waitForDataLoaded if origin matched',
              timeout: 5000,
              data: () => {
                let originInUrl = '';
                // url initial value is empty after webview mounted first time
                const url1 = event.target.getURL(); // url won't update immediately when goForward or goBack
                const url2 = event.target.src;
                const url3 = src;
                const url = url1 || url2 || url3;
                if (url) {
                  try {
                    const uri = new URL(url);
                    originInUrl = uri?.origin || '';
                  } catch {
                    // noop
                  }
                }
                if (
                  originInUrl &&
                  originInRequest &&
                  originInUrl === originInRequest
                ) {
                  origin = originInRequest;
                  return true;
                }
                return false;
              },
            });
          } catch (error) {
            // noop
          } finally {
            // noop
          }
          if (origin) {
            // - receive
            jsBridgeHost.receive(data, { origin });
          } else {
            // TODO log error if url is empty
          }
        }

        // response back
        // webview.send();
      };
      webview.addEventListener('ipc-message', handleMessage);
      return () => {
        webview.removeEventListener('ipc-message', handleMessage);
      };
    }, [jsBridgeHost, isWebviewReady, src]);

    const preloadJsUrl = usePreloadJsUrl();

    if (!preloadJsUrl) {
      return null;
    }

    return (
      <>
        {isDev && (
          <button
            type="button"
            style={{
              fontSize: 12,
              padding: 0,
              opacity: 0.6,
              position: 'absolute',
              right: devToolsAtLeft ? undefined : 0,
              left: devToolsAtLeft ? 0 : undefined,
            }}
            onClick={() => {
              setDevToolsAtLeft(!devToolsAtLeft);
              webviewRef.current?.openDevTools();
            }}
          >
            DevTools
          </button>
        )}
        <webview
          ref={initWebviewByRef}
          preload={preloadJsUrl}
          src={src}
          partition="webview"
          style={{
            'width': '100%',
            'height': '100%',
            ...style,
          }}
          allowpopups={allowpopups}
          // @ts-expect-error
          nodeintegration="true"
          nodeintegrationinsubframes="true"
          webpreferences="contextIsolation=0, contextisolation=0, nativeWindowOpen=1, sandbox=0"
          // mobile user-agent
          // useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
          {...props}
        />
        {desktopLoadError && (
          <Stack position="absolute" top={0} bottom={0} left={0} right={0}>
            <ErrorView
              onRefresh={() => {
                webviewRef.current?.reload();
              }}
            />
          </Stack>
        )}
      </>
    );
  },
);
DesktopWebView.displayName = 'DesktopWebView';

export { DesktopWebView };
