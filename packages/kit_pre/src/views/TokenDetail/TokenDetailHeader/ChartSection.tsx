import type { FC } from 'react';
import { useMemo } from 'react';

import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import MarketPriceChart from '../../Market/Components/MarketDetail/MarketPriceChart';
import PriceChart from '../../PriceChart/PriceChart';

import type { HomeRoutes } from '../../../routes/routesEnum';
import type { HomeRoutesParams } from '../../../routes/types';

export const ChartSection: FC<
  Pick<
    HomeRoutesParams[HomeRoutes.ScreenTokenDetail],
    'networkId' | 'coingeckoId' | 'tokenAddress' | 'symbol'
  >
> = (props) => {
  const { networkId = '', coingeckoId, tokenAddress, symbol } = props;

  const content = useMemo(() => {
    if (isAllNetworks(networkId)) {
      return <MarketPriceChart coingeckoId={coingeckoId ?? ''} />;
    }

    return (
      <PriceChart
        networkId={networkId}
        contract={tokenAddress}
        coingeckoId={coingeckoId}
        symbol={symbol}
        key={`${networkId}--${tokenAddress ?? ''}`}
      />
    );
  }, [coingeckoId, symbol, networkId, tokenAddress]);

  return content;
};
