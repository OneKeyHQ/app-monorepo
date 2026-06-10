import { useRef } from 'react';

import { ChartWebView } from '.';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getMarketChartReadyKey,
  getPerpsChartReadyKey,
  markChartDataReady,
} from '../chartDataReadyStore';
import { useTradingViewUrl } from '../hooks';
import { usePerpsTradingViewMessageHandler } from '../TradingViewPerpsV2/messageHandlers';
import { useTradingViewMessageHandler } from '../TradingViewV2/messageHandlers';

import {
  CHART_WEBVIEW_SCENE,
  getChartWebViewMode,
  useChartBootSnapshotReady,
} from './constants';

import type { IWebViewRef } from '../../WebView/types';

// Neutral symbol the prewarm falls back to when no symbol is given — used to
// RESET the shared page off a previous context's symbol (e.g. back on market
// home after perps). Matches the unified boot placeholder (HL:BTC).
const PREWARM_RESET_COIN = 'BTC';
const PREWARM_RESET_SOURCE = 'hyperliquid';

export interface IChartPrewarmProps {
  // Pre-select a symbol on the shared page so opening the chart needs no switch.
  // Omit to reset the page to the neutral placeholder instead.
  symbol?: string;
  // Routing source for `symbol` (defaults to hyperliquid/perps).
  source?: 'market' | 'hyperliquid';
  // Market source only: encode the unified market symbol so the prewarmed chart
  // requests the right token kline (cached for the detail to reuse).
  // decimal only affects the price scale, not the kline request, so a rough value is
  // fine — the detail corrects it without re-fetching bars.
  networkId?: string;
  address?: string;
  decimal?: number;
}

// The hidden offscreen container the prewarmed (warm-driver) WebView lives in.
function PrewarmStack({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      position="absolute"
      left={-9999}
      top={-9999}
      width={1}
      height={1}
      opacity={0}
      pointerEvents="none"
    >
      {children}
    </Stack>
  );
}

// Perps prewarm host: wires the SAME data handler the perps chart detail uses
// (usePerpsTradingViewMessageHandler), so the page's $private requests
// (getKLineData / price scale / marks) are SERVICED during warm — not dropped.
// Without a handler the prewarm WebView was a data-less shell (msgDroppedNoHandler).
function PerpsPrewarmHost({
  params,
  symbol,
}: {
  params: Record<string, string>;
  symbol: string;
}) {
  const webRef = useRef<IWebViewRef | null>(null);
  // userAddress omitted: kline / price-scale don't need it (only marks/fills do),
  // and the detail re-asserts those on focus.
  const { customReceiveHandler } = usePerpsTradingViewMessageHandler({
    symbol,
    webRef,
    // Also flip the shared loading flag from the prewarm host: the bars-state
    // signal is routed to whichever host owns the WebView when it fires, which
    // can be THIS offscreen prewarm (esp. on Android, which has no warmDriver
    // fallback) — without this it would be dropped and the detail would stay on
    // the loading mask forever. Key must match the perps detail host exactly.
    onBarsState: () => {
      // Any bars-state event means getBars resolved for this chart (data
      // present OR confirmed empty) — stop showing the loading mask.
      markChartDataReady(getPerpsChartReadyKey(symbol));
    },
  });

  return (
    <ChartWebView
      params={params}
      onlineUrl=""
      flex={1}
      prewarm
      customReceiveHandler={customReceiveHandler}
      onWebViewRef={(r) => {
        webRef.current = r;
      }}
    />
  );
}

// Market prewarm host: wires the market data handler (useTradingViewMessageHandler
// -> klineDataHandler) so the prewarmed page can fetch the token kline.
function MarketPrewarmHost({
  params,
  symbol,
  networkId,
  address,
}: {
  params: Record<string, string>;
  symbol: string;
  networkId?: string;
  address?: string;
}) {
  const webRef = useRef<IWebViewRef | null>(null);
  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress: address ?? '',
    networkId: networkId ?? '',
    tokenSymbol: symbol,
    webRef,
    // Key must match the market detail host exactly (surface + network + address
    // + symbol) so this prewarm's bars-state clears the detail's mask.
    onBarsState: () => {
      // Any bars-state event means getBars resolved for this chart (data
      // present OR confirmed empty) — stop showing the loading mask.
      markChartDataReady(
        getMarketChartReadyKey({ networkId, tokenAddress: address, symbol }),
      );
    },
  });

  return (
    <ChartWebView
      params={params}
      onlineUrl=""
      flex={1}
      prewarm
      customReceiveHandler={customReceiveHandler}
      onWebViewRef={(r) => {
        webRef.current = r;
      }}
    />
  );
}

/**
 * Keeps the single shared unified chart WebView warm and pre-positioned while the
 * user is on a screen they reach just before a chart (market home, perps home).
 * The hidden host boots the offline page, drives its symbol, AND services its
 * data requests (via the same handler the real detail uses), so opening the chart
 * reuses an already-booted, already-on-the-right-symbol, already-has-data page.
 *
 * Per-context behavior:
 *   - with `symbol`  -> pre-select it (e.g. perps home injects the active pair)
 *   - without symbol -> RESET to the neutral placeholder (e.g. market home clears
 *     a leftover perps symbol)
 *
 * Native + unified only; renders nothing otherwise (ChartWebView is native-only).
 */
export function ChartPrewarm({
  symbol,
  source = 'hyperliquid',
  networkId,
  address,
  decimal,
}: IChartPrewarmProps = {}) {
  // Prewarm is iOS-ONLY. iOS WKWebView auto-throttles the offscreen prewarm page,
  // so warming is cheap and never contends. Android WebView does NOT throttle
  // offscreen pages: the prewarm host kept the shared WebView's renderer running
  // offscreen (CPU/GPU/RAM burn -> OOM) AND its symbol-driving contended the
  // visible chart's switch (market stuck on the wrong symbol). Disabled on Android
  // pending a cheaper warm strategy.
  // Ready barrier (Gate 2): do NOT prewarm until the cold-start chart-mode
  // snapshot is populated, otherwise the prewarm host could read an
  // uninitialized snapshot (bootstrap init is fire-and-forget and prewarm can
  // out-race it).
  const bootSnapshotReady = useChartBootSnapshotReady();
  const enabled =
    bootSnapshotReady &&
    platformEnv.isNativeIOS &&
    getChartWebViewMode() !== 'legacy' &&
    CHART_WEBVIEW_SCENE === 'unified';

  // Always drive a symbol (real one, or the neutral reset) so focusing this
  // screen actively positions the shared page, instead of leaving whatever the
  // previous screen left.
  const effectiveSymbol = symbol ?? PREWARM_RESET_COIN;
  const effectiveSource = symbol ? source : PREWARM_RESET_SOURCE;
  const isMarket = effectiveSource === 'market';
  const { params } = useTradingViewUrl({
    additionalParams: {
      symbol: effectiveSymbol,
      type: isMarket ? 'market' : 'perps',
      ...(isMarket
        ? {
            networkId: networkId ?? '',
            address: address ?? '',
            ...(decimal !== undefined ? { decimal: String(decimal) } : {}),
          }
        : {}),
    },
  });

  if (!enabled) return null;

  return (
    <PrewarmStack>
      {isMarket ? (
        <MarketPrewarmHost
          params={params}
          symbol={effectiveSymbol}
          networkId={networkId}
          address={address}
        />
      ) : (
        <PerpsPrewarmHost params={params} symbol={effectiveSymbol} />
      )}
    </PrewarmStack>
  );
}

export default ChartPrewarm;
