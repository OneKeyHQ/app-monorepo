import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import MarketNetworkFilter from './MarketNetworkFilter';
import MarketTokenListNetworkSelectorSkeleton from './MarketTokenListNetworkSelectorSkeleton';

import type { IMarketNetworkFilterRef } from './MarketNetworkFilter';

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
  forceLoading?: boolean;
}

function MarketTokenListNetworkSelector({
  selectedNetworkId,
  onSelectNetworkId,
  forceLoading,
}: IMarketTokenListNetworkSelectorProps) {
  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >();
  const marketNetworkFilterRef = useRef<IMarketNetworkFilterRef>(null);

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
      const defaultNetwork = selectedNetworkId
        ? marketNetworks.find((n) => n.networkId === selectedNetworkId) ||
          marketNetworks[0]
        : marketNetworks[0];
      setCurrentSelectNetwork(defaultNetwork);
    }
  }, [marketNetworks, currentSelectNetwork, selectedNetworkId]);

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

      // 使用 setTimeout 确保状态更新后再滚动
      setTimeout(() => {
        marketNetworkFilterRef.current?.scrollToNetwork(network.networkId);
      }, 100);
    },
    [onSelectCurrentNetwork],
  );

  return (
    <Stack paddingVertical="$3" paddingHorizontal="$5">
      {isLoading || forceLoading ? (
        <MarketTokenListNetworkSelectorSkeleton />
      ) : (
        <MarketNetworkFilter
          ref={marketNetworkFilterRef}
          networks={marketNetworks}
          selectedNetwork={currentSelectNetwork}
          onSelectNetwork={onSelectCurrentNetwork}
          onMoreNetworkSelect={handleMoreNetworkSelect}
        />
      )}
    </Stack>
  );
}

const MarketTokenListNetworkSelectorComponent = memo(
  MarketTokenListNetworkSelector,
);

export default MarketTokenListNetworkSelectorComponent;
