/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react/no-unknown-property */
import type { ComponentProps, Ref } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { Stack } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import {
  checkOneKeyCardGoogleOauthUrl,
  needEraseElectronFeatureUrl,
} from '@onekeyhq/shared/src/utils/uriUtils';

import ErrorView from './ErrorView';
import { WEBVIEW_LOAD_TIMEOUT_MS, createMessageInjectedScript } from './utils';

import type {
  IElectronWebView,
  IElectronWebViewEvents,
  IInpageProviderWebViewProps,
  IWebViewRef,
} from './types';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type {
  DidFailLoadEvent,
  DidStartNavigationEvent,
  Event,
} from 'electron';

type IDesktopDidFailLoadEvent = DidFailLoadEvent & {
  url?: string;
};

// Used for webview type referencing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const WEBVIEW_TAG = 'webview';

export function isTrustedPrimePurchaseUrl(
  currentUrl: string | undefined,
  configuredSrc: string | undefined,
): boolean {
  if (!currentUrl || !configuredSrc) {
    return false;
  }
  try {
    const current = new URL(currentUrl);
    const configured = new URL(configuredSrc);
    if (
      current.searchParams.get('render') !== 'prime-purchase' ||
      configured.searchParams.get('render') !== 'prime-purchase'
    ) {
      return false;
    }
    if (current.protocol === 'file:' && configured.protocol === 'file:') {
      return current.pathname === configured.pathname;
    }
    return (
      current.origin !== 'null' &&
      current.origin === configured.origin &&
      current.pathname === configured.pathname
    );
  } catch {
    return false;
  }
}

const DesktopIsolatedWebView = forwardRef(
  (
    {
      src,
      style,
      receiveHandler,
      allowpopups,
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
    const [isWebviewReady, setIsWebviewReady] = useState(false);
    const [isDomReady, setIsDomReady] = useState(false);
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
          console.error(
            'DesktopIsolatedWebView: failed to flush queued script',
            error,
          );
        }
      }
    }, [isDomReady]);

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
            console.error(e);
          }
        };

        const innerHandleDidFailLoad = (event: IDesktopDidFailLoadEvent) => {
          const failedUrl = event?.validatedURL ?? event?.url;
          if (event.isMainFrame) {
            clearLoadTimeout();
          }
          if (event.errorCode !== -3 && event.isMainFrame) {
            lastMainFrameLoadErrorRef.current = {
              url: failedUrl,
              errorCode: event.errorCode,
              errorDescription: event.errorDescription,
            };
            setDesktopLoadError(true);
            setDesktopLoadErrorCode(event.errorCode);
          }
          onDidFailLoad?.(event);
        };

        const innerHandleDidStartNavigation = (
          event: DidStartNavigationEvent,
        ) => {
          const { isMainFrame, isInPlace, url } = event ?? {};
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
          if (isMainFrame && !isInPlace) {
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
            return;
          }
          if (isMainFrame) {
            onDidStartNavigation?.(event);
          }
        };

        const handleDomReady = (event: Event) => {
          updateIsDomReady(true);
          onDomReady?.(event);
        };

        webview.addEventListener('did-start-loading', onDidStartLoading);
        webview.addEventListener(
          'did-start-navigation',
          innerHandleDidStartNavigation,
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
        webview.addEventListener('dom-ready', handleDomReady);

        return () => {
          clearLoadTimeout();
          webview.removeEventListener('did-start-loading', onDidStartLoading);
          webview.removeEventListener(
            'did-start-navigation',
            innerHandleDidStartNavigation,
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

    // Optional route-pinned message channel for the isolated desktop Prime
    // checkout (?render=prime-purchase). Never injects preload.js or connects
    // to backgroundApiProxy.
    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isWebviewReady || !receiveHandler) {
        return;
      }

      const handleConsoleMessage = (event: { message?: string }) => {
        if (
          typeof event?.message !== 'string' ||
          !event.message.startsWith(PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX)
        ) {
          return;
        }
        const currentUrl = webview.getURL?.() || webview.src || src;
        if (!isTrustedPrimePurchaseUrl(currentUrl, src)) {
          return;
        }
        try {
          const parsed = JSON.parse(
            event.message.slice(PRIME_PURCHASE_CONSOLE_MESSAGE_PREFIX.length),
          ) as IJsBridgeMessagePayload;
          if (
            parsed &&
            typeof parsed === 'object' &&
            parsed.scope === '$private' &&
            parsed.data &&
            typeof parsed.data === 'object' &&
            typeof (parsed.data as { method?: unknown }).method === 'string'
          ) {
            void receiveHandler(parsed, undefined as never);
          }
        } catch {
          // Ignore malformed console payloads.
        }
      };

      webview.addEventListener('console-message', handleConsoleMessage);
      return () => {
        webview.removeEventListener('console-message', handleConsoleMessage);
      };
    }, [isWebviewReady, receiveHandler, src]);

    useEffect(
      () => () => {
        isUnmountingRef.current = true;
        clearLoadTimeout();
        webviewRef.current?.closeDevTools();
      },
      [clearLoadTimeout],
    );

    useImperativeHandle(
      ref as Ref<unknown>,
      (): IWebViewWrapperRef => {
        const wrapper = {
          get innerRef() {
            return webviewRef.current;
          },
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
                  'DesktopIsolatedWebView: queued script count exceeded 50, dropping oldest entry.',
                );
                pendingScriptsRef.current.shift();
              }
              return;
            }
            try {
              webviewRef.current.executeJavaScript(script);
            } catch (error) {
              console.error(
                'DesktopIsolatedWebView: failed to execute script',
                error,
              );
            }
          },
        };
        return wrapper as IWebViewRef;
      },
      [],
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
      flushPendingScripts();
    }, [flushPendingScripts, isWebviewReady]);

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
          src={src}
          partition={partitionProp ?? 'persist:onekey'}
          style={{
            'width': '100%',
            'height': '100%',
            ...style,
          }}
          // @ts-expect-error
          nodeintegration="false"
          allowpopups={allowpopups}
          webpreferences="contextIsolation=1, nativeWindowOpen=1, sandbox=1"
          disableblinkfeatures="Notifications"
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
DesktopIsolatedWebView.displayName = 'DesktopIsolatedWebView';

export { DesktopIsolatedWebView };
