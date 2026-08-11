import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Spinner, Stack } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewProps } from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { loadTradingViewEmbedModule } from './tradingViewEmbedLoader.web';
import { migrateLegacyTradingViewStorage } from './tradingViewLegacyStorageMigration.web';

import type { ITradingViewEmbedHandle } from './tradingViewEmbedLoader.web';
import type { WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';

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
  const customReceiveHandlerRef = useRef(customReceiveHandler);
  const onLoadStartRef = useRef(onLoadStart);
  const [fallback, setFallback] = useState(false);
  const [mounted, setMounted] = useState(false);
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
          handleRef.current?.postMessage(message);
        },
      }) as IWebViewRef,
    [],
  );

  useEffect(() => {
    setRuntimeUrl(src);
  }, [src]);

  useEffect(() => {
    onWebViewRef?.(webViewRef);
    return () => onWebViewRef?.(null);
  }, [onWebViewRef, webViewRef]);

  useLayoutEffect(
    () => () => {
      handleRef.current?.unmount();
      handleRef.current = null;
    },
    [],
  );

  useEffect(() => {
    setFallback(false);
    setMounted(false);
  }, [reloadRevision, runtimeUrl]);

  useEffect(() => {
    if (fallback) {
      return undefined;
    }
    const container = containerRef.current;
    if (!container || !runtimeUrl) {
      return undefined;
    }

    let cancelled = false;
    onLoadStartRef.current?.(createLoadStartEvent(runtimeUrl));

    void loadTradingViewEmbedModule(runtimeUrl)
      .then(async ({ assetBaseUrl, module }) => {
        if (cancelled) {
          return;
        }
        await migrateLegacyTradingViewStorage(runtimeUrl).catch(
          (error: unknown) => {
            defaultLogger.app.error.log(
              `[TradingViewRuntimeView] Legacy storage migration failed: ${String(
                error,
              )}`,
            );
          },
        );
        if (cancelled) {
          return;
        }
        const url = new URL(runtimeUrl, globalThis.location.href);
        const handle = await module.mountTradingView({
          assetBaseUrl,
          container,
          onMessage(payload) {
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
        });
        if (cancelled) {
          handle.unmount();
          return;
        }
        handleRef.current = handle;
        setMounted(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          defaultLogger.app.error.log(
            `[TradingViewRuntimeView] DOM runtime failed, using iframe: ${String(
              error,
            )}`,
          );
          setFallback(true);
        }
      });

    return () => {
      cancelled = true;
      handleRef.current?.unmount();
      handleRef.current = null;
    };
  }, [fallback, reloadRevision, runtimeUrl]);

  if (fallback) {
    return (
      <WebView
        {...fallbackProps}
        containerProps={containerProps}
        customReceiveHandler={customReceiveHandler}
        onLoadStart={onLoadStart}
        onWebViewRef={onWebViewRef}
        src={runtimeUrl}
      />
    );
  }

  return (
    <Stack flex={1} bg="$bgApp" {...containerProps}>
      {/* The container must stay mounted at all times: the effect resolves it
          through containerRef before the Embed runtime is available, so the
          pending state is an overlay rather than a conditional branch. */}
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {mounted ? null : (
        <Stack
          position="absolute"
          left={0}
          right={0}
          top={0}
          bottom={0}
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <Spinner size="large" />
        </Stack>
      )}
    </Stack>
  );
}
