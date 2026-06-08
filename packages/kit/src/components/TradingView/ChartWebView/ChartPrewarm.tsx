import { ChartWebView } from '.';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTradingViewUrl } from '../hooks';

import { CHART_WEBVIEW_MODE, CHART_WEBVIEW_SCENE } from './constants';

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

/**
 * Keeps the single shared unified chart WebView warm and pre-positioned while the
 * user is on a screen they reach just before a chart (market home, perps home).
 * While focused, this hidden host owns the pooled WebView and drives its symbol;
 * when the user opens a real chart, that chart reuses the already-booted, already-
 * on-the-right-symbol page via SYMBOL_CHANGE with no reload.
 *
 * Per-context behavior (each screen mounts its own and only drives while focused,
 * so switching tabs hands the symbol over cleanly):
 *   - with `symbol`  -> pre-select it (e.g. perps home injects the active pair)
 *   - without symbol -> RESET to the neutral placeholder (e.g. market home clears
 *     a leftover perps symbol)
 *
 * Do NOT mount on a screen that already renders a real chart with the same pool
 * key — two active hosts would fight for the one shared WebView.
 *
 * Memory: does NOT add a second WebView — the pool is a singleton, so this just
 * creates the one shared WebView earlier. Switching charts afterwards reuses it.
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
  const enabled =
    platformEnv.isNative &&
    CHART_WEBVIEW_MODE !== 'legacy' &&
    CHART_WEBVIEW_SCENE === 'unified';

  // Always drive a symbol (real one, or the neutral reset) so focusing this
  // screen actively positions the shared page, instead of leaving whatever the
  // previous screen left. The constant unified source strips the symbol, so the
  // page is still reused without reload — this only feeds the SYMBOL_CHANGE.
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
    <Stack
      position="absolute"
      left={-9999}
      top={-9999}
      width={1}
      height={1}
      opacity={0}
      pointerEvents="none"
    >
      <ChartWebView params={params} onlineUrl="" flex={1} />
    </Stack>
  );
}

export default ChartPrewarm;
