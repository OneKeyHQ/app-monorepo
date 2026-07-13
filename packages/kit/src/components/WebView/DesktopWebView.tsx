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
  useSyncExternalStore,
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
import { EDesktopWebViewPreloadKind } from './types';
import { WEBVIEW_LOAD_TIMEOUT_MS, createMessageInjectedScript } from './utils';

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
type IDesktopDidFailLoadEvent = DidFailLoadEvent & {
  url?: string;
};

type IBridgePreloadKind = Exclude<
  EDesktopWebViewPreloadKind,
  EDesktopWebViewPreloadKind.None
>;

const DEFAULT_PRELOAD_KIND = EDesktopWebViewPreloadKind.Dapp;
const preloadJsUrls: Partial<Record<IBridgePreloadKind, string>> = {};
const preloadJsUrlPromises: Partial<
  Record<IBridgePreloadKind, Promise<string>>
> = {};
const preloadJsUrlListeners = new Set<() => void>();

function emitPreloadJsUrlChange() {
  preloadJsUrlListeners.forEach((listener) => {
    listener();
  });
}

function subscribePreloadJsUrl(listener: () => void) {
  preloadJsUrlListeners.add(listener);
  return () => {
    preloadJsUrlListeners.delete(listener);
  };
}

function isDesktopChartPreloadReady() {
  const globals =
    globalThis.ONEKEY_DESKTOP_GLOBALS_GETTER?.() ??
    globalThis.ONEKEY_DESKTOP_GLOBALS;
  return !!globals?.tradingViewOfflineReady;
}

function getPreloadJsContent(kind: IBridgePreloadKind) {
  if (kind === EDesktopWebViewPreloadKind.Chart) {
    return globalThis.desktopApiProxy.webview.getChartPreloadJsContent();
  }
  return globalThis.desktopApiProxy.webview.getPreloadJsContent();
}

function getPreloadJsUrl(kind: IBridgePreloadKind) {
  const resolvedUrl = preloadJsUrls[kind];
  if (resolvedUrl) {
    return Promise.resolve(resolvedUrl);
  }
  preloadJsUrlPromises[kind] ??= getPreloadJsContent(kind)
    .then((url: string) => {
      preloadJsUrls[kind] = url;
      emitPreloadJsUrlChange();
      return url;
    })
    .catch((error: unknown) => {
      preloadJsUrlPromises[kind] = undefined;
      throw error;
    });
  return preloadJsUrlPromises[kind];
}

function getDesktopWebViewOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.origin && parsed.origin !== 'null') {
      return parsed.origin;
    }
    if (parsed.protocol && parsed.host) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    // noop
  }
  return '';
}

// Used for webview type referencing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const WEBVIEW_TAG = 'webview';

const DesktopWebView = forwardRef(
  (
    {
      src,
      style,
      receiveHandler,
      allowpopups,
      disableBridge,
      preloadKind = DEFAULT_PRELOAD_KIND,
      partition: partitionProp,
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
      onShouldStartLoadWithRequest,
      ...props
    }: ComponentProps<typeof WEBVIEW_TAG> &
      IElectronWebViewEvents &
      IInpageProviderWebViewProps,
    ref: any,
  ) => {
    const bridgeDisabled =
      disableBridge || preloadKind === EDesktopWebViewPreloadKind.None;
    const requestedBridgePreloadKind =
      preloadKind === EDesktopWebViewPreloadKind.None
        ? DEFAULT_PRELOAD_KIND
        : preloadKind;
    const bridgePreloadKind =
      requestedBridgePreloadKind === EDesktopWebViewPreloadKind.Chart &&
      !isDesktopChartPreloadReady()
        ? DEFAULT_PRELOAD_KIND
        : requestedBridgePreloadKind;
    const [isWebviewReady, setIsWebviewReady] = useState(false);
    const [isDomReady, setIsDomReady] = useState(false);
    // Parents hold wrapper closures across renders, so dom-ready must be read
    // from a ref, not a render snapshot.
    const isDomReadyRef = useRef(false);
    const updateIsDomReady = useCallback((value: boolean) => {
      isDomReadyRef.current = value;
      setIsDomReady(value);
    }, []);
    const webviewRef = useRef<IElectronWebView | null>(null);
    const pendingScriptsRef = useRef<string[]>([]);
    const [devToolsAtLeft, setDevToolsAtLeft] = useState(false);
    const [devSettings] = useDevSettingsPersistAtom();
    const isUnmountingRef = useRef(false);
    const getPreloadJsUrlSnapshot = useCallback(
      () => preloadJsUrls[bridgePreloadKind] ?? '',
      [bridgePreloadKind],
    );
    const resolvedPreloadJsUrl = useSyncExternalStore(
      subscribePreloadJsUrl,
      getPreloadJsUrlSnapshot,
      getPreloadJsUrlSnapshot,
    );
    const [preloadJsUrlErrorKind, setPreloadJsUrlErrorKind] =
      useState<IBridgePreloadKind | null>(null);
    const preloadJsUrlError = preloadJsUrlErrorKind === bridgePreloadKind;

    const [desktopLoadError, setDesktopLoadError] = useState(false);
    const [desktopLoadErrorCode, setDesktopLoadErrorCode] = useState<number>();
    const lastMainFrameLoadErrorRef = useRef<
      | {
          url?: string;
          errorCode?: number;
          errorDescription?: string;
        }
      | undefined
    >(undefined);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLoadTimeout = useCallback(() => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }, []);

    const startLoadTimeout = useCallback(() => {
      clearLoadTimeout();
      loadTimeoutRef.current = setTimeout(() => {
        if (!isUnmountingRef.current) {
          setDesktopLoadError(true);
          setDesktopLoadErrorCode(undefined);
        }
      }, WEBVIEW_LOAD_TIMEOUT_MS);
    }, [clearLoadTimeout]);

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

    useEffect(() => {
      if (bridgeDisabled || preloadJsUrlError || resolvedPreloadJsUrl) {
        return undefined;
      }

      let isMounted = true;
      void getPreloadJsUrl(bridgePreloadKind)
        .then(() => undefined)
        .catch(() => {
          if (isMounted) {
            setPreloadJsUrlErrorKind(bridgePreloadKind);
          }
        });

      return () => {
        isMounted = false;
      };
    }, [
      bridgeDisabled,
      bridgePreloadKind,
      preloadJsUrlError,
      resolvedPreloadJsUrl,
    ]);

    useEffect(() => {
      if (resolvedPreloadJsUrl && preloadJsUrlError) {
        setPreloadJsUrlErrorKind(null);
      }
    }, [preloadJsUrlError, resolvedPreloadJsUrl]);

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

        const innerHandleDidFailLoad = (event: IDesktopDidFailLoadEvent) => {
          const failedUrl = event?.validatedURL ?? event?.url;
          if (event.isMainFrame) {
            clearLoadTimeout();
          }
          if (event.errorCode !== -3) {
            // TODO iframe error also show ErrorView
            //      testing www.163.com
            if (event.isMainFrame) {
              lastMainFrameLoadErrorRef.current = {
                url: failedUrl,
                errorCode: event.errorCode,
                errorDescription: event.errorDescription,
              };
              setDesktopLoadError(true);
              setDesktopLoadErrorCode(event.errorCode);
            }
          }
          onDidFailLoad?.(event);
        };

        const innerHandleDidStartNavigationNavigation = (
          event: DidStartNavigationEvent,
        ) => {
          const { isMainFrame, url } = event ?? {};
          if (isMainFrame && onShouldStartLoadWithRequest && url) {
            const shouldLoad = onShouldStartLoadWithRequest({
              url,
              isTopFrame: true,
            });
            if (!shouldLoad) {
              webviewRef.current?.stop();
              return;
            }
          }
          if (isMainFrame) {
            lastMainFrameLoadErrorRef.current = undefined;
            setDesktopLoadError(false);
            setDesktopLoadErrorCode(undefined);
            updateIsDomReady(false);
            startLoadTimeout();
          }
          checkGoogleOauth(url);
          checkEraseElectronFeature(url);
          onDidStartNavigation?.(event);
        };

        const didFinishLoad = (e: any) => {
          clearLoadTimeout();
          if (!lastMainFrameLoadErrorRef.current) {
            setDesktopLoadError(false);
            setDesktopLoadErrorCode(undefined);
          }
          onDidFinishLoad?.();
          onLoadEnd?.(e);
        };

        const innerHandleDidStopLoading = () => {
          clearLoadTimeout();
          onDidStopLoading?.();
        };

        // Server-side HTTP redirects (302 / 301) reach the new URL through
        // `did-redirect-navigation`. Without an explicit listener the safety
        // check in `did-start-navigation` may fire too late to abort the
        // redirected request, so re-run the URL guard and stop the load if
        // the target is not allowed.
        const innerHandleDidRedirectNavigation = (
          event: DidStartNavigationEvent,
        ) => {
          const { isMainFrame, url } = event ?? {};
          if (
            isMainFrame &&
            onShouldStartLoadWithRequest &&
            url &&
            !onShouldStartLoadWithRequest({ url, isTopFrame: true })
          ) {
            webviewRef.current?.stop();
          }
        };

        webview.addEventListener('did-start-loading', onDidStartLoading);
        webview.addEventListener(
          'did-start-navigation',
          innerHandleDidStartNavigationNavigation,
        );
        webview.addEventListener(
          'did-redirect-navigation',
          innerHandleDidRedirectNavigation,
        );
        webview.addEventListener('did-finish-load', didFinishLoad);
        webview.addEventListener('did-stop-loading', innerHandleDidStopLoading);
        webview.addEventListener('did-fail-load', innerHandleDidFailLoad);
        webview.addEventListener('page-title-updated', onPageTitleUpdated);
        webview.addEventListener('page-favicon-updated', onPageFaviconUpdated);
        webview.addEventListener('new-window', onNewWindow);
        const handleDomReady = (event: Event) => {
          updateIsDomReady(true);
          onDomReady?.(event);
        };

        webview.addEventListener('dom-ready', handleDomReady);

        return () => {
          clearLoadTimeout();
          webview.removeEventListener('did-start-loading', onDidStartLoading);
          webview.removeEventListener(
            'did-start-navigation',
            innerHandleDidStartNavigationNavigation,
          );
          webview.removeEventListener(
            'did-redirect-navigation',
            innerHandleDidRedirectNavigation,
          );
          webview.removeEventListener('did-finish-load', didFinishLoad);
          webview.removeEventListener(
            'did-stop-loading',
            innerHandleDidStopLoading,
          );
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
      // the first run can precede <webview> mount when the preload URL
      // resolves async, leaving every load listener unregistered.
      isWebviewReady,
      clearLoadTimeout,
      startLoadTimeout,
      updateIsDomReady,
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
      onShouldStartLoadWithRequest,
    ]);
    if (isDev && props.preload) {
      console.warn(
        'DesktopWebView:  custom preload url may disable built-in injected function',
      );
    }

    useEffect(
      () => () => {
        isUnmountingRef.current = true;
        clearLoadTimeout();
        // not working, ref is null after unmount
        webviewRef.current?.closeDevTools();
      },
      [clearLoadTimeout],
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
          // deferred preload mounts the node after the first create; the
          // isWebviewReady dep re-snapshots innerRef once it exists.
          innerRef: isWebviewReady ? webviewRef.current : null,
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
            if (!isDomReadyRef.current || !webviewRef.current) {
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
      // dom-ready is read via isDomReadyRef so a parent holding an old
      // wrapper still delivers.
      [isWebviewReady, jsBridgeHost],
    );

    const initWebviewByRef = useCallback(
      ($ref: any) => {
        webviewRef.current = $ref;
        updateIsDomReady(false);
        setIsWebviewReady(Boolean($ref));
      },
      [updateIsDomReady],
    );

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isWebviewReady || bridgeDisabled) {
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
                  originInUrl = getDesktopWebViewOrigin(url);
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
          } catch (_error) {
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
    }, [jsBridgeHost, isWebviewReady, src, bridgeDisabled]);

    useEffect(() => {
      flushPendingScripts();
    }, [flushPendingScripts, isWebviewReady]);

    if (preloadJsUrlError && !bridgeDisabled) {
      return (
        <Stack flex={1} position="relative" bg="$bgApp">
          <ErrorView
            onRefresh={() => {
              setPreloadJsUrlErrorKind(null);
            }}
          />
        </Stack>
      );
    }

    if (!resolvedPreloadJsUrl && !bridgeDisabled) {
      return null;
    }
    return (
      <Stack flex={1} position="relative" bg="$bgApp">
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
          {...(bridgeDisabled ? {} : { preload: resolvedPreloadJsUrl })}
          src={src}
          partition={partitionProp ?? 'persist:onekey'}
          style={{
            'width': '100%',
            'height': '100%',
            ...style,
          }}
          // Electron interprets blinkFeatures="false" as a feature name to
          // enable, triggering a security warning (enableBlinkFeatures) without
          // actually disabling anything. Added in #4874 intending to disable
          // blink features, but the correct way is to simply omit the attribute.
          // @ts-expect-error
          nodeintegration="false"
          allowpopups={allowpopups}
          webpreferences="contextIsolation=1, nativeWindowOpen=1, sandbox=1"
          // https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5
          disableblinkfeatures="Notifications"
          // mobile user-agent
          // useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
          {...props}
        />
        {desktopLoadError ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={0}
            zIndex={1}
            bg="$bgApp"
          >
            <ErrorView
              errorCode={desktopLoadErrorCode}
              onRefresh={() => {
                setDesktopLoadError(false);
                setDesktopLoadErrorCode(undefined);
                webviewRef.current?.reload();
              }}
            />
          </Stack>
        ) : null}
      </Stack>
    );
  },
);
DesktopWebView.displayName = 'DesktopWebView';

export { DesktopWebView };
