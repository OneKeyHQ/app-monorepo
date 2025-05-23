import { memo, useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

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
  >();
  const [marketNetworks, setMarketNetworks] = useState<ISwapNetwork[]>([]);

  useEffect(() => {
    void backgroundApiProxy.serviceMarketV2.fetchMarketChains().then((data) => {
      const networks = (data?.list || []).map(
        (chain) =>
          ({
            networkId: chain.networkId,
            name: chain.name,
            logoURI: chain.logoUrl,
            symbol: chain.name.toUpperCase(),
            shortcode: chain.name.toLowerCase(),
          } as ISwapNetwork),
      );
      setMarketNetworks(networks);
      if (networks.length > 0) {
        setCurrentSelectNetwork(networks[0]);
      }
    });
  }, []);

  const onSelectCurrentNetwork = useCallback(
    (network: ISwapNetwork) => {
      setCurrentSelectNetwork(network);
      onSelectNetworkId?.(network.networkId);
    },
    [onSelectNetworkId],
  );

  return (
    <MarketNetworkFilter
      networks={marketNetworks}
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
