import {
  HL_DISPLAY_SYMBOL_PREFIX,
  TRADING_VIEW_MARKET_HYPERLIQUID_SCENE,
} from '../constants';

export interface IChartSymbolChangeMessage {
  type: 'SYMBOL_CHANGE';
  payload: {
    source: 'market' | 'hyperliquid';
    symbol: string;
    networkId?: string;
    address?: string;
    decimal?: string;
    displayPair?: string;
    displayCoin?: string;
    force: boolean;
  };
}

/**
 * Build the unified-host `SYMBOL_CHANGE` message from the chart URL params.
 *
 * Shared by the desktop and native chart hosts so the source/symbol mapping
 * stays in one place (and is unit-testable).
 *
 * `source` selects the chart-side datafeed and must be 'hyperliquid' for BOTH
 * perps AND market tokens whose K-line源 is Hyperliquid (scene =
 * `market-hyperliquid`, set by useHyperLiquidKlineSource). The previous check
 * looked only at `type === 'perps'`, so HL-backed market tokens (e.g. BTC)
 * wrongly routed to the OneKey market datafeed — which has no candles for them —
 * producing dashes / zero volume / an "Onekey" exchange label. The classic
 * (non-unified) 6.3.0 path carried `scene=market-hyperliquid` in the URL and
 * routed correctly; the unified migration dropped that signal.
 *
 * HL-backed market tokens carry a display symbol like `HL:BTC`. The chart's
 * unified encoder re-applies the `HL:` prefix for the hyperliquid源, so we send
 * the bare coin (`BTC`) to avoid `HL:HL:BTC`, while keeping the prefixed label
 * for display (displayPair/displayCoin).
 */
export function buildSymbolChangeMessage(
  params: Record<string, string>,
): IChartSymbolChangeMessage {
  const isHyperliquid =
    params.type === 'perps' ||
    params.scene === TRADING_VIEW_MARKET_HYPERLIQUID_SCENE;
  const source = isHyperliquid ? 'hyperliquid' : 'market';

  const rawSymbol = params.symbol ?? '';
  // Strip the display prefix ONLY for the hyperliquid源 so the bare coin reaches
  // the datafeed. Non-hyperliquid symbols are passed through untouched even if
  // they happened to start with 'HL:'.
  const symbol =
    isHyperliquid && rawSymbol.startsWith(HL_DISPLAY_SYMBOL_PREFIX)
      ? rawSymbol.slice(HL_DISPLAY_SYMBOL_PREFIX.length)
      : rawSymbol;

  return {
    type: 'SYMBOL_CHANGE',
    payload: {
      source,
      symbol,
      networkId: params.networkId,
      address: params.address,
      decimal: params.decimal,
      // Display labels stay UI-only and keep the original (prefixed) symbol.
      displayPair: params.symbol,
      displayCoin: params.symbol,
      force: false,
    },
  };
}
