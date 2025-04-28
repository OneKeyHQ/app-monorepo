import { memo, useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { swapNetworksIncludeAllNetwork } from './data';
import MarketNetworkFilter from './MarketNetworkFilter';

export const swapNetworksCommonCount = 10;
export const swapNetworksCommonCountMD = 5;

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
}

function MarketTokenListNetworkSelector({
  selectedNetworkId: _selectedNetworkId,
  onSelectNetworkId,
}: IMarketTokenListNetworkSelectorProps) {
  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >(() => swapNetworksIncludeAllNetwork?.[0]);
  const onSelectCurrentNetwork = useCallback(
    (network: ISwapNetwork) => {
      setCurrentSelectNetwork(network);
      onSelectNetworkId?.(network.networkId);
    },
    [onSelectNetworkId],
  );

  useEffect(() => {
    backgroundApiProxy.serviceMarket
      .fetchMarketChains()
      .then((data: ISwapNetwork[]) => {
        console.log('Fetched market chains:', data);
        // TODO: You can set the fetched chains to state here if needed
        // For example:
        // if (data && data.length > 0) {
        //   setAvailableNetworks(data);
        //   setCurrentSelectNetwork(data[0]);
        //   onSelectNetworkId?.(data[0].networkId);
        // }
      })
      .catch((error: unknown) => {
        console.error('Failed to fetch market chains:', error);
      });
  }, [onSelectNetworkId]); // Assuming onSelectNetworkId doesn't change often, or add other dependencies if necessary

  return (
    <MarketNetworkFilter
      networks={swapNetworksIncludeAllNetwork}
      selectedNetwork={currentSelectNetwork}
      onSelectNetwork={onSelectCurrentNetwork}
      moreNetworksCount={2}
      onMoreNetwork={() => {
        console.log('TODO: onMoreNetwork');
      }}
    />
  );
}

const MarketTokenListNetworkSelectorComponent = memo(
  MarketTokenListNetworkSelector,
);

export default MarketTokenListNetworkSelectorComponent;
