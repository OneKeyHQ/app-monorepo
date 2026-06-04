import { useEffect, useMemo, useRef } from 'react';

import {
  type ChartWebviewMethods,
  type ChartWebviewProps,
  ChartWebviewView,
} from '@onekeyfe/react-native-chart-webview';
import { type HybridView, callback } from 'react-native-nitro-modules';

import { Stack } from '@onekeyhq/components';

import {
  CHART_WEBVIEW_ENTRY,
  CHART_WEBVIEW_LOCAL_BUNDLE,
  CHART_WEBVIEW_MODE,
} from './constants';

import type { IChartWebViewProps } from './types';
import type { IWebViewRef } from '../../WebView/types';

export function ChartWebView({
  params,
  onlineUrl,
  customReceiveHandler,
  onWebViewRef,
  ...stackStyle
}: IChartWebViewProps) {
  const hybridRefHolder = useRef<ChartWebviewMethods | null>(null);

  // Adapter exposing the IWebViewRef surface used by TradingView hooks/handlers
  // (sendMessageViaInjectedScript / reload), backed by the chart-webview
  // module's imperative methods. Lets every existing call site work unchanged.
  const adapterRef = useRef<IWebViewRef | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = {
      sendMessageViaInjectedScript: (message: unknown) => {
        // Module injects window.postMessage(JSON.parse(str)); the legacy script
        // did window.postMessage(message) — equivalent.
        hybridRefHolder.current?.postMessage(JSON.stringify(message));
      },
      reload: () => {
        hybridRefHolder.current?.reload();
      },
      loadURL: () => {
        // no-op: source switching is code-level (remount via key)
      },
    } as unknown as IWebViewRef;
  }

  useEffect(() => {
    onWebViewRef?.(adapterRef.current);
    return () => {
      onWebViewRef?.(null);
    };
  }, [onWebViewRef]);

  const source = useMemo(() => {
    if (CHART_WEBVIEW_MODE === 'online') {
      return { uri: onlineUrl };
    }
    return {
      localBundle: CHART_WEBVIEW_LOCAL_BUNDLE,
      entry: CHART_WEBVIEW_ENTRY,
      paramsJson: JSON.stringify(params),
    };
  }, [onlineUrl, params]);

  // Nitro requires function props wrapped with callback(). The hybridRef callback
  // hands us a ref whose .current is the live HybridObject (postMessage/reload).
  const hybridRefProp = useMemo(
    () =>
      callback((r: HybridView<ChartWebviewProps, ChartWebviewMethods>) => {
        hybridRefHolder.current = r;
      }),
    [],
  );

  const onMessageProp = useMemo(
    () =>
      callback((raw: string) => {
        try {
          // Module delivers the chart's $private.request payload as a raw JSON
          // string; legacy handlers expect it wrapped as { data: payload }.
          void customReceiveHandler?.({ data: JSON.parse(raw) });
        } catch {
          // ignore malformed messages
        }
      }),
    [customReceiveHandler],
  );

  // Remount when the source mode/url changes so the new source loads cleanly.
  const sourceKey =
    CHART_WEBVIEW_MODE === 'online' ? `online:${onlineUrl}` : 'offline';

  return (
    <Stack position="relative" flex={1} {...stackStyle}>
      <ChartWebviewView
        key={sourceKey}
        style={{ flex: 1 }}
        {...source}
        hybridRef={hybridRefProp}
        onMessage={onMessageProp}
      />
    </Stack>
  );
}

export default ChartWebView;
