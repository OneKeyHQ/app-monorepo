import { useMemo } from 'react';

import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks/useMarketBasicConfig';
import type { IMarketBasicConfigHyperLiquidKlineSourceToken } from '@onekeyhq/shared/types/marketV2';

export interface IHyperLiquidKlineSourceResult {
  isHyperLiquidSource: boolean;
  symbol: string | undefined;
  isLoading: boolean;
}

// Optimistic hardcoded HL-source tokens, used ONLY while the server basic-config
// is still loading. Without this, an HL-backed market token (e.g. BTC) bakes the
// chart URL as the OneKey market datafeed on the first frame (config not ready →
// isHyperLiquidSource=false), so the legacy WebView first loads the WRONG
// close-only market candles, then reloads to HL once the config resolves —
// causing a visible flash + a wasted load on cold open. Seeding the known tokens
// here makes the first URL already HL. When the real config arrives it takes over;
// if it disagrees with this guess the result flips, the URL changes, and the
// existing src-change reload corrects the chart. Keep this list tiny and only for
// tokens we're confident are HL-backed, to minimize wrong-guess reloads.
const HARDCODED_HL_SOURCE_TOKENS: IMarketBasicConfigHyperLiquidKlineSourceToken[] =
  [{ networkId: 'btc--0', tokenAddress: '', symbol: 'BTC' }];

export function useHyperLiquidKlineSource(
  networkId: string,
  tokenAddress: string,
): IHyperLiquidKlineSourceResult {
  const { basicConfig, isLoading } = useMarketBasicConfig();

  return useMemo(() => {
    const configTokens = basicConfig?.HyperLiquidKlineSourceTokens;
    const configReady = !isLoading && !!configTokens;

    // While the real config is loading, fall back to the optimistic hardcoded
    // table so known HL tokens (BTC) bake the HL URL on the first frame. Once the
    // config resolves it takes over (and reconciles via the src-change reload).
    const tokens = configReady ? configTokens : HARDCODED_HL_SOURCE_TOKENS;
    const match = tokens.find(
      (token) =>
        token.networkId === networkId && token.tokenAddress === tokenAddress,
    );

    return {
      isHyperLiquidSource: !!match,
      symbol: match?.symbol,
      // Still report loading until the real config settles, so callers that wait
      // on it (the chart-mount gate) know the value may yet be reconciled.
      isLoading: !configReady,
    };
  }, [basicConfig, isLoading, networkId, tokenAddress]);
}
