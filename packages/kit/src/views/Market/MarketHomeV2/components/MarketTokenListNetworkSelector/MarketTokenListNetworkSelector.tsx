import { memo, useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getDefaultEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import MarketNetworkFilter from './MarketNetworkFilter';

export const swapNetworksCommonCount = 10;
export const swapNetworksCommonCountMD = 5;

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
}

const mapServerNetworkToSwapNetwork = (
  serverNetwork?: IServerNetwork,
): ISwapNetwork | undefined => {
  if (!serverNetwork) {
    return undefined;
  }
  return {
    networkId: serverNetwork.id, // Map id to networkId
    name: serverNetwork.name,
    symbol: serverNetwork.symbol,
    shortcode: serverNetwork.shortcode,
    logoURI: serverNetwork.logoURI,
    isAllNetworks: serverNetwork.isAllNetworks,
    // Optional ISwapNetworkBase properties will be undefined if not in IServerNetwork
  };
};

const mapServerNetworksToSwapNetworks = (
  serverNetworks: IServerNetwork[],
): ISwapNetwork[] =>
  serverNetworks.map(mapServerNetworkToSwapNetwork).filter(Boolean);

function MarketTokenListNetworkSelector({
  selectedNetworkId: _selectedNetworkId,
  onSelectNetworkId,
}: IMarketTokenListNetworkSelectorProps) {
  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >(() =>
    mapServerNetworkToSwapNetwork(
      getDefaultEnabledNetworksInAllNetworks()?.[0],
    ),
  );
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
        //   setAvailableNetworks(mapServerNetworksToSwapNetworks(data)); // Assuming data might be IServerNetwork[]
        //   setCurrentSelectNetwork(data[0]);
        //   onSelectNetworkId?.(data[0].networkId);
        // }
      })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      .catch((error: unknown) => {
        console.error('Failed to fetch market chains:', error);
      });
  }, [onSelectNetworkId]); // Assuming onSelectNetworkId doesn't change often, or add other dependencies if necessary

  return (
    <MarketNetworkFilter
      networks={mapServerNetworksToSwapNetworks(
        getDefaultEnabledNetworksInAllNetworks(),
      )}
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
