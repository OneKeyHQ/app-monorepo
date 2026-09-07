import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';

import { Spinner, Stack } from '@onekeyhq/components';
import { TradingViewV1 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV1';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { TokenPriceChart } from '../../../Market/components/TokenPriceChart';

import { resolveMarketChartTicker } from './resolveMarketChartTicker';

function ExchangeChart({
  ticker,
  fallback,
}: {
  ticker: NonNullable<ReturnType<typeof resolveMarketChartTicker>>;
  fallback: ReactElement;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const onLoadEnd = useCallback(() => setIsLoading(false), []);
  const onLoadError = useCallback(() => setHasLoadError(true), []);

  if (hasLoadError) {
    return fallback;
  }

  return (
    <Stack height={340} minHeight={0} width="100%" testID="asset-market-chart">
      <TradingViewV1
        {...ticker}
        flex={1}
        onLoadEnd={onLoadEnd}
        onLoadError={onLoadError}
      />
      {isLoading ? (
        <Stack
          position="absolute"
          inset={0}
          bg="$bgApp"
          ai="center"
          jc="center"
          pointerEvents="none"
        >
          <Spinner size="large" />
        </Stack>
      ) : null}
    </Stack>
  );
}

export function MarketDetailChart({
  coinGeckoId,
  token,
}: {
  coinGeckoId: string;
  token: IMarketTokenDetail;
}) {
  const ticker = resolveMarketChartTicker(coinGeckoId, token);
  // Tokens without a supported exchange pair keep the existing app datafeed.
  return ticker ? (
    <ExchangeChart
      key={`${ticker.identifier}:${ticker.baseToken}:${ticker.targetToken}`}
      ticker={ticker}
      fallback={<TokenPriceChart coinGeckoId={coinGeckoId} token={token} />}
    />
  ) : (
    <TokenPriceChart coinGeckoId={coinGeckoId} token={token} />
  );
}
