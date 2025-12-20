import type { ComponentProps } from 'react';

import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { TokenPriceChart as TokenPriceChartBase } from '../../../components/TokenPriceChart';

type ITokenPriceChartProps = {
  coinGeckoId: string;
  tokenDetail?: IMarketTokenDetail;
  defer: ComponentProps<typeof TokenPriceChartBase>['defer'];
};

export function TokenPriceChart({
  coinGeckoId,
  tokenDetail,
  defer,
}: ITokenPriceChartProps) {
  return (
    <TokenPriceChartBase
      isFetching={!tokenDetail}
      tickers={tokenDetail?.tickers}
      fallbackToChart={!!tokenDetail?.fallbackToChart}
      tvPlatform={tokenDetail?.tvPlatform}
      coinGeckoId={coinGeckoId}
      defer={defer}
      symbol={tokenDetail?.symbol}
    />
  );
}
