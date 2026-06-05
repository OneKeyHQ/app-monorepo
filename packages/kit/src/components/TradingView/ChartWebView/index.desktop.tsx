import { useCallback, useEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';

import { chartOverlayController } from './chartOverlay/controller';

import type { IChartOverlayRect } from './chartOverlay/controller';
import type { IChartWebViewProps } from './types';
import type { IWebViewRef } from '../../WebView/types';

let HOST_SEQ = 0;

/**
 * Desktop chart host.
 *
 * Unlike native (where each ChartWebView grabs the same pooled native WebView),
 * desktop keeps ONE persistent <webview> at the app root (ChartOverlayRoot).
 * This component renders only a placeholder that reserves the chart's layout
 * space and reports its rect; while focused it becomes the active owner of the
 * shared webview, which is positioned over this placeholder. All TradingView
 * hooks keep working unchanged via the controller-backed IWebViewRef adapter,
 * and token switches ride SYMBOL_CHANGE with no reload — the desktop equivalent
 * of native's warm unified chart.
 */
export function ChartWebView({
  params,
  customReceiveHandler,
  onWebViewRef,
  onLoadEnd,
  selfDrivenSymbol,
  ...stackStyle
}: IChartWebViewProps) {
  const idRef = useRef<string>('');
  if (!idRef.current) {
    HOST_SEQ += 1;
    idRef.current = `chart-host-${HOST_SEQ}`;
  }
  const id = idRef.current;
  const isFocused = useRouteIsFocused();

  // The placeholder DOM node the shared webview is positioned over.
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  // Latest values for the controller's stable callbacks (registered once).
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const receiveRef = useRef(customReceiveHandler);
  receiveRef.current = customReceiveHandler;
  const onLoadEndRef = useRef(onLoadEnd);
  onLoadEndRef.current = onLoadEnd;
  const selfDrivenRef = useRef(!!selfDrivenSymbol);
  selfDrivenRef.current = !!selfDrivenSymbol;
  const onWebViewRefRef = useRef(onWebViewRef);
  onWebViewRefRef.current = onWebViewRef;

  const getRect = useCallback((): IChartOverlayRect | null => {
    const el = placeholderRef.current;
    if (!el || typeof el.getBoundingClientRect !== 'function') return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, []);

  // Register with the controller once; hand the adapter to the consumer so every
  // existing TradingView hook (kline/marks/symbol) drives the shared webview.
  useEffect(() => {
    const adapter: IWebViewRef = chartOverlayController.register({
      id,
      getRect,
      receive: (data) => {
        void receiveRef.current?.(data);
      },
      getParams: () => paramsRef.current,
      selfDrivenSymbol: selfDrivenRef.current,
      onLoadEnd: () => {
        onLoadEndRef.current?.();
      },
    });
    onWebViewRefRef.current?.(adapter);
    return () => {
      chartOverlayController.unregister(id);
      onWebViewRefRef.current?.(null);
    };
  }, [id, getRect]);

  // Own the shared webview while this screen is focused.
  useEffect(() => {
    if (isFocused) {
      chartOverlayController.setActive(id);
    }
  }, [isFocused, id]);

  // Re-assert our symbol whenever it changes while focused (idempotent no-op when
  // the shared page already shows it). Skipped for self-driven hosts (perps).
  useEffect(() => {
    if (isFocused && !selfDrivenRef.current) {
      chartOverlayController.syncActiveSymbol();
    }
  }, [isFocused, params]);

  return (
    <Stack position="relative" flex={1} {...stackStyle}>
      <div ref={placeholderRef} style={{ width: '100%', height: '100%' }} />
    </Stack>
  );
}

export default ChartWebView;
