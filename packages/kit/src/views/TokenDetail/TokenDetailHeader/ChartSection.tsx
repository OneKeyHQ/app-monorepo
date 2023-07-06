import { useContext, useMemo } from 'react';

import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import MarketPriceChart from '../../Market/Components/MarketDetail/MarketPriceChart';
import PriceChart from '../../PriceChart/PriceChart';
import { TokenDetailContext } from '../context';

export const ChartSection = () => {
  const context = useContext(TokenDetailContext);

  const {
    networkId = '',
    coingeckoId,
    tokenAddress,
    symbol,
  } = context?.routeParams ?? {};

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
