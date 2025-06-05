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

  return (
    <Stack paddingVertical="$3" paddingHorizontal="$5">
      {isLoading || forceLoading ? (
        <MarketTokenListNetworkSelectorSkeleton />
      ) : (
        <MarketNetworkFilter
          networks={marketNetworks}
          selectedNetwork={currentSelectNetwork}
          onSelectNetwork={onSelectCurrentNetwork}
          moreNetworksCount={2}
          onMoreNetwork={() => {
            console.log('TODO: onMoreNetwork');
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
