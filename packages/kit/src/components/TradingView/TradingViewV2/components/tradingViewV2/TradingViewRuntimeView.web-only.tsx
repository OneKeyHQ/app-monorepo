import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Stack } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewProps } from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { loadTradingViewEmbedModule } from './tradingViewEmbedLoader.web';
import { createTradingViewEmbedReadyMonitor } from './tradingViewEmbedReady.web';

import type { ITradingViewEmbedHandle } from './tradingViewEmbedLoader.web';
import type { WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';

const TRADING_VIEW_EMBED_FAILURE_KEY_PREFIX =
  'onekey_tradingview_embed_failed:';

function getRuntimeFailureKey(runtimeUrl: string): string | undefined {
  try {
    const origin = new URL(runtimeUrl, globalThis.location.href).origin;
    return `${TRADING_VIEW_EMBED_FAILURE_KEY_PREFIX}${origin}`;
  } catch {
    return undefined;
  }
}

function hasRuntimeFailedInSession(runtimeUrl: string): boolean {
  const key = getRuntimeFailureKey(runtimeUrl);
  if (!key) {
    return false;
  }
  try {
    return globalThis.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function rememberRuntimeFailure(runtimeUrl: string): void {
  const key = getRuntimeFailureKey(runtimeUrl);
  if (!key) {
    return;
  }
  try {
    globalThis.sessionStorage.setItem(key, '1');
  } catch {
    // Session storage is optional; fallback still applies to this mount.
  }
}

function createLoadStartEvent(url: string): WebViewNavigationEvent {
  return {
    nativeEvent: {
      canGoBack: false,
      canGoForward: false,
      loading: true,
      target: 0,
      title: '',
      url,
    },
  } as unknown as WebViewNavigationEvent;
}

export default function TradingViewRuntimeView({
  src = '',
  containerProps,
  customReceiveHandler,
  onLoadStart,
  onWebViewRef,
  ...fallbackProps
}: IWebViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ITradingViewEmbedHandle | null>(null);
  const mountingModuleRef = useRef<
    Awaited<ReturnType<typeof loadTradingViewEmbedModule>>['module'] | null
  >(null);
  const customReceiveHandlerRef = useRef(customReceiveHandler);
  const onLoadStartRef = useRef(onLoadStart);
  const fallbackWebViewRef = useRef<IWebViewRef | null>(null);
  const [fallback, setFallback] = useState(() =>
    hasRuntimeFailedInSession(src),
  );
  const [runtimeUrl, setRuntimeUrl] = useState(src);
  const [reloadRevision, setReloadRevision] = useState(0);

  customReceiveHandlerRef.current = customReceiveHandler;
  onLoadStartRef.current = onLoadStart;

  const webViewRef = useMemo<IWebViewRef>(
    () =>
      ({
        loadURL(url: string) {
          setRuntimeUrl(url);
        },
        reload() {
          setReloadRevision((revision) => revision + 1);
        },
        sendMessageViaInjectedScript(message: unknown) {
          if (handleRef.current) {
            handleRef.current.postMessage(message);
            return;
          }
          mountingModuleRef.current?.postTradingViewMessage(message);
        },
      }) as IWebViewRef,
    [],
  );

  const handleFallbackWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      fallbackWebViewRef.current = ref;
      if (fallback) {
        onWebViewRef?.(ref);
      }
    },
    [fallback, onWebViewRef],
  );

  useEffect(() => {
    setRuntimeUrl(src);
  }, [src]);

  useLayoutEffect(() => {
    onWebViewRef?.(fallback ? fallbackWebViewRef.current : webViewRef);
    return () => onWebViewRef?.(null);
  }, [fallback, onWebViewRef, webViewRef]);

  useLayoutEffect(
    () => () => {
      handleRef.current?.unmount();
      handleRef.current = null;
      mountingModuleRef.current = null;
    },
    [],
  );

  useEffect(() => {
    setFallback(hasRuntimeFailedInSession(runtimeUrl));
  }, [reloadRevision, runtimeUrl]);

  useEffect(() => {
    if (fallback) {
      return undefined;
    }
    if (hasRuntimeFailedInSession(runtimeUrl)) {
      setFallback(true);
      return undefined;
    }
    const container = containerRef.current;
    if (!container || !runtimeUrl) {
      return undefined;
    }

    let cancelled = false;
    let runtimeFailed = false;
    let readyMonitor: ReturnType<
      typeof createTradingViewEmbedReadyMonitor
    > | null = null;
    const useIframeFallback = (error: unknown) => {
      if (runtimeFailed) {
        return;
      }
      runtimeFailed = true;
      rememberRuntimeFailure(runtimeUrl);
      readyMonitor?.cancel();
      if (!cancelled) {
        handleRef.current?.unmount();
        handleRef.current = null;
        mountingModuleRef.current = null;
        defaultLogger.app.error.log(
          `[TradingViewRuntimeView] DOM runtime failed, using iframe: ${String(
            error,
          )}`,
        );
        setFallback(true);
      }
    };
    onLoadStartRef.current?.(createLoadStartEvent(runtimeUrl));

    const monitor = createTradingViewEmbedReadyMonitor();
    readyMonitor = monitor;
    // Chart readiness includes the first data request, so it must not be used
    // as an embed startup timeout. Explicit chart errors still fall back.
    void monitor.wait().catch(useIframeFallback);

    const mountPromise = loadTradingViewEmbedModule(runtimeUrl).then(
      async ({ assetBaseUrl, module }) => {
        if (cancelled || runtimeFailed) {
          return;
        }
        const url = new URL(runtimeUrl, globalThis.location.href);
        mountingModuleRef.current = module;
        await module
          .mountTradingView({
            assetBaseUrl,
            container,
            onMessage(payload) {
              monitor.notify(payload);
              void Promise.resolve(
                customReceiveHandlerRef.current?.({ data: payload }),
              ).catch((error: unknown) => {
                defaultLogger.app.error.log(
                  `[TradingViewRuntimeView] Message handling failed: ${String(
                    error,
                  )}`,
                );
              });
            },
            params: url.searchParams,
          })
          .then((handle) => {
            if (cancelled || runtimeFailed) {
              handle.unmount();
              return;
            }
            handleRef.current = handle;
            mountingModuleRef.current = null;
          });
      },
    );
    void mountPromise.catch(useIframeFallback);

    return () => {
      cancelled = true;
      runtimeFailed = true;
      readyMonitor?.cancel();
      handleRef.current?.unmount();
      handleRef.current = null;
      mountingModuleRef.current = null;
    };
  }, [fallback, reloadRevision, runtimeUrl]);

  if (fallback) {
    return (
      <WebView
        {...fallbackProps}
        containerProps={containerProps}
        customReceiveHandler={customReceiveHandler}
        onLoadStart={onLoadStart}
        onWebViewRef={handleFallbackWebViewRef}
        skipBackgroundBridge
        src={runtimeUrl}
      />
    );
  }

  return (
    <Stack flex={1} bg="$bgApp" {...containerProps}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </Stack>
  );
}
