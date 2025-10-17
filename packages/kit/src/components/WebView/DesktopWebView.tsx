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
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  checkOneKeyCardGoogleOauthUrl,
  needEraseElectronFeatureUrl,
} from '@onekeyhq/shared/src/utils/uriUtils';

import ErrorView from './ErrorView';
import { createMessageInjectedScript } from './utils';

import type {
  IElectronWebView,
  IElectronWebViewEvents,
  IInpageProviderWebViewProps,
  IWebViewRef,
} from './types';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type {
  DidFailLoadEvent,
  DidStartNavigationEvent,
  Event,
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

let preloadJsUrl = '';

void globalThis.desktopApiProxy.webview.getPreloadJsContent().then((url) => {
  preloadJsUrl = url;
});

// Used for webview type referencing
const WEBVIEW_TAG = 'webview';

const DesktopWebView = forwardRef(
  (
    {
      src,
      style,
      receiveHandler,
      allowpopups,
      onDidStartLoading,
      onDidStartNavigation,
      onDidFinishLoad,
      onDidStopLoading,
      onDidFailLoad,
      onPageTitleUpdated,
      onPageFaviconUpdated,
      onLoadEnd,
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
    const [isDomReady, setIsDomReady] = useState(false);
    const webviewRef = useRef<IElectronWebView | null>(null);
    const pendingScriptsRef = useRef<string[]>([]);
    const [devToolsAtLeft, setDevToolsAtLeft] = useState(false);
    const [devSettings] = useDevSettingsPersistAtom();

    const [desktopLoadError, setDesktopLoadError] = useState(false);

    const flushPendingScripts = useCallback(() => {
      if (!isDomReady || !webviewRef.current) {
        return;
      }
      while (pendingScriptsRef.current.length) {
        const script = pendingScriptsRef.current.shift();
        if (!script) {
          // eslint-disable-next-line no-continue
          continue;
        }
        try {
          webviewRef.current.executeJavaScript(script);
        } catch (error) {
          console.error('DesktopWebView: failed to flush queued script', error);
        }
      }
    }, [isDomReady]);

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

        const checkEraseElectronFeature = (checkUrl: string) => {
          try {
            if (needEraseElectronFeatureUrl({ url: checkUrl })) {
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
            setIsDomReady(false);
          }
          checkGoogleOauth(url);
          checkEraseElectronFeature(url);
          onDidStartNavigation?.(event);
        };

        const didFinishLoad = (e: any) => {
          onDidFinishLoad?.();
          onLoadEnd?.(e);
        };

        webview.addEventListener('did-start-loading', onDidStartLoading);
        webview.addEventListener(
          'did-start-navigation',
          innerHandleDidStartNavigationNavigation,
        );
        webview.addEventListener('did-finish-load', didFinishLoad);
        webview.addEventListener('did-stop-loading', onDidStopLoading);
        webview.addEventListener('did-fail-load', innerHandleDidFailLoad);
        webview.addEventListener('page-title-updated', onPageTitleUpdated);
        webview.addEventListener('page-favicon-updated', onPageFaviconUpdated);
        webview.addEventListener('new-window', onNewWindow);
        const handleDomReady = (event: Event) => {
          setIsDomReady(true);
          onDomReady?.(event);
        };

        webview.addEventListener('dom-ready', handleDomReady);

        return () => {
          webview.removeEventListener('did-start-loading', onDidStartLoading);
          webview.removeEventListener(
            'did-start-navigation',
            innerHandleDidStartNavigationNavigation,
          );
          webview.removeEventListener('did-finish-load', didFinishLoad);
          webview.removeEventListener('did-stop-loading', onDidStopLoading);
          webview.removeEventListener('did-fail-load', innerHandleDidFailLoad);
          webview.removeEventListener('page-title-updated', onPageTitleUpdated);
          webview.removeEventListener(
            'page-favicon-updated',
            onPageFaviconUpdated,
          );
          webview.removeEventListener('new-window', onNewWindow);
          webview.removeEventListener('dom-ready', handleDomReady);
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
      onLoadEnd,
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
    const jsBridgeHost = useMemo(() => {
      const b = new JsBridgeDesktopHost({
        webviewRef,
        receiveHandler,
      });
      if (process.env.NODE_ENV !== 'production') {
        // @ts-ignore
        b.$$devInstanceUUID = stringUtils.generateUUID();
      }
      return b;
    }, [receiveHandler]);

    useImperativeHandle(
      ref as Ref<unknown>,
      (): IWebViewWrapperRef => {
        const wrapper = {
          innerRef: webviewRef.current,
          jsBridge: jsBridgeHost,
          reload: () => {
            webviewRef.current?.reload();
          },
          loadURL: (url: string) => {
            if (webviewRef.current && url) {
              webviewRef.current.loadURL(url);
            }
          },
          sendMessageViaInjectedScript: (message: unknown) => {
            const script = createMessageInjectedScript(message);
            if (!isDomReady || !webviewRef.current) {
              pendingScriptsRef.current.push(script);
              if (pendingScriptsRef.current.length > 50) {
                console.warn(
                  'DesktopWebView: queued script count exceeded 50, dropping oldest entry.',
                );
                pendingScriptsRef.current.shift();
              }
              return;
            }
            if (webviewRef.current) {
              try {
                webviewRef.current.executeJavaScript(script);
              } catch (error) {
                console.error(
                  'DesktopWebView: failed to execute script',
                  error,
                );
              }
            }
          },
        };
        jsBridgeHost.webviewWrapper = wrapper;
        return wrapper as IWebViewRef;
      },
      [isDomReady, jsBridgeHost],
    );

    const initWebviewByRef = useCallback(($ref: any) => {
      webviewRef.current = $ref;
      setIsDomReady(false);
      setIsWebviewReady(Boolean($ref));
    }, []);

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isWebviewReady) {
        return;
      }

      // only enable message for current focused webview
      jsBridgeHost.globalOnMessageEnabled = true;
      // connect background jsBridge
      backgroundApiProxy.connectBridge(jsBridgeHost as unknown as JsBridgeBase);

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

    useEffect(() => {
      flushPendingScripts();
    }, [flushPendingScripts, isWebviewReady]);

    if (!preloadJsUrl) {
      return null;
    }

    console.log('preloadJsUrl', preloadJsUrl);

    return (
      <>
        {devSettings?.enabled && devSettings?.settings?.showWebviewDevTools ? (
          <button
            data-testid="webview-dev-tools"
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
        ) : null}
        <webview
          ref={initWebviewByRef}
          preload={preloadJsUrl}
          src={src}
          partition="persist:onekey"
          style={{
            'width': '100%',
            'height': '100%',
            ...style,
          }}
          blinkfeatures="false"
          // @ts-expect-error
          nodeintegration="false"
          allowpopups={allowpopups}
          webpreferences="contextIsolation=0, nativeWindowOpen=1, sandbox=1"
          // https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5
          disableblinkfeatures="Notifications"
          // mobile user-agent
          // useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
          {...props}
        />
        {desktopLoadError ? (
          <Stack position="absolute" top={0} bottom={0} left={0} right={0}>
            <ErrorView
              onRefresh={() => {
                webviewRef.current?.reload();
              }}
            />
          </Stack>
        ) : null}
      </>
    );
  },
);
DesktopWebView.displayName = 'DesktopWebView';

export { DesktopWebView };
