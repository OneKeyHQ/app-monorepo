import { useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewProps } from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import {
  getTradingViewEmbedBaseUrl,
  loadTradingViewEmbedModule,
} from './tradingViewEmbedLoader.web';

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
  const [fallback, setFallback] = useState(false);
  const [runtimeUrl, setRuntimeUrl] = useState(src);
  const [reloadRevision, setReloadRevision] = useState(0);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !runtimeUrl) {
      return undefined;
    }

    let cancelled = false;
    setFallback(false);
    onLoadStart?.(createLoadStartEvent(runtimeUrl));

    void loadTradingViewEmbedModule()
      .then(async (module) => {
        if (cancelled) {
          return;
        }
        const url = new URL(runtimeUrl, globalThis.location.href);
        const handle = await module.mountTradingView({
          assetBaseUrl: getTradingViewEmbedBaseUrl(),
          container,
          onMessage(payload) {
            void Promise.resolve(
              customReceiveHandler?.({ data: payload }),
            ).catch((error: unknown) => {
              console.error(
                '[TradingViewRuntimeView] Message handling failed:',
                error,
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
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error(
            '[TradingViewRuntimeView] DOM runtime failed, using iframe:',
            error,
          );
          setFallback(true);
        }
      });

    return () => {
      cancelled = true;
      handleRef.current?.unmount();
      handleRef.current = null;
    };
  }, [customReceiveHandler, onLoadStart, reloadRevision, runtimeUrl]);

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
    <Stack flex={1} bg="background-default" {...containerProps}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </Stack>
  );
}
