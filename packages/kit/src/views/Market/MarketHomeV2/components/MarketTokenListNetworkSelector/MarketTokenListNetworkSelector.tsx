import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import MarketNetworkFilter from './MarketNetworkFilter';
import MarketTokenListNetworkSelectorSkeleton from './MarketTokenListNetworkSelectorSkeleton';

export const swapNetworksCommonCount = 10;
export const swapNetworksCommonCountMD = 5;

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
  forceLoading?: boolean;
}

function MarketTokenListNetworkSelector({
  selectedNetworkId: _selectedNetworkId,
  onSelectNetworkId,
  forceLoading,
}: IMarketTokenListNetworkSelectorProps) {
  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >();

  const { result: marketChainsData, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceMarketV2.fetchMarketChains(),
    [],
  );

  const marketNetworks = useMemo(() => {
    if (!marketChainsData?.list) return [];
    return marketChainsData.list.map(
      (chain) =>
        ({
          networkId: chain.networkId,
          name: chain.name,
          logoURI: chain.logoUrl,
          symbol: chain.name.toUpperCase(),
          shortcode: chain.name.toLowerCase(),
        } as ISwapNetwork),
    );
  }, [marketChainsData]);

  // Calculate the number of networks to show in the filter vs more networks
  const { visibleNetworks, moreNetworksCount } = useMemo(() => {
    const maxVisible = 8; // Show up to 8 networks in the filter
    if (marketNetworks.length <= maxVisible) {
      return {
        visibleNetworks: marketNetworks,
        moreNetworksCount: 0,
      };
    }
    return {
      visibleNetworks: marketNetworks.slice(0, maxVisible),
      moreNetworksCount: marketNetworks.length - maxVisible,
    };
  }, [marketNetworks]);

  // Set default selected network when networks are loaded
  useEffect(() => {
    if (marketNetworks.length > 0 && !currentSelectNetwork) {
      setCurrentSelectNetwork(marketNetworks[0]);
    }
  }, [marketNetworks, currentSelectNetwork]);

  const onSelectCurrentNetwork = useCallback(
    (network: ISwapNetwork) => {
      setCurrentSelectNetwork(network);
      onSelectNetworkId?.(network.networkId);
    },
    [onSelectNetworkId],
  );

  const handleMoreNetworkSelect = useCallback(
    (network: ISwapNetwork) => {
      onSelectCurrentNetwork(network);
    },
    [onSelectCurrentNetwork],
  );

  return (
    <Stack paddingVertical="$3" paddingHorizontal="$5">
      {isLoading || forceLoading ? (
        <MarketTokenListNetworkSelectorSkeleton />
      ) : (
        <MarketNetworkFilter
          networks={visibleNetworks}
          selectedNetwork={currentSelectNetwork}
          onSelectNetwork={onSelectCurrentNetwork}
          moreNetworksCount={moreNetworksCount}
          moreNetworks={marketNetworks}
          onMoreNetworkSelect={handleMoreNetworkSelect}
          onMoreNetwork={() => {
            console.log('More network button clicked');
          }}
        />
      )}
    </Stack>
  );
}

const MarketTokenListNetworkSelectorComponent = memo(
  MarketTokenListNetworkSelector,
);

export default MarketTokenListNetworkSelectorComponent;
