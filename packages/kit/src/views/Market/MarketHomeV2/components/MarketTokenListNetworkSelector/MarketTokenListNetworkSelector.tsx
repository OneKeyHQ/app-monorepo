import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useMedia } from '@onekeyhq/components';
import {
  useSwapActions,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { SwapProviderMirror } from '@onekeyhq/kit/src/views/Swap/pages/SwapProviderMirror';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import MarketNetworkFilter from './MarketNetworkFilter';

export const swapNetworksCommonCount = 10;
export const swapNetworksCommonCountMD = 5;

interface IMarketTokenListNetworkSelectorProps {
  selectedNetworkId?: string;
  onSelectNetworkId?: (networkId: string) => void;
}

function MarketTokenListNetworkSelector({
  selectedNetworkId,
  onSelectNetworkId,
}: IMarketTokenListNetworkSelectorProps) {
  const { md } = useMedia();
  const { swapLoadAllNetworkTokenList } = useSwapActions().current;
  const [swapNetworksIncludeAllNetwork] =
    useSwapNetworksIncludeAllNetworkAtom();
  const [protocol] = useSwapTypeSwitchAtom();

  const [currentSelectNetwork, setCurrentSelectNetwork] = useState<
    ISwapNetwork | undefined
  >(
    () =>
      swapNetworksIncludeAllNetwork.find(
        (n) => n.networkId === selectedNetworkId,
      ) ?? swapNetworksIncludeAllNetwork?.[0],
  );

  useEffect(() => {
    // Update internal state if the external prop changes
    const newNetwork = swapNetworksIncludeAllNetwork.find(
      (n) => n.networkId === selectedNetworkId,
    );
    if (
      newNetwork &&
      newNetwork.networkId !== currentSelectNetwork?.networkId
    ) {
      setCurrentSelectNetwork(newNetwork);
    } else if (!newNetwork && selectedNetworkId === undefined) {
      // Handle case where external prop becomes undefined (e.g., reset to all)
      setCurrentSelectNetwork(swapNetworksIncludeAllNetwork?.[0]);
    }
  }, [
    selectedNetworkId,
    swapNetworksIncludeAllNetwork,
    currentSelectNetwork?.networkId,
  ]);

  // Trigger data loading on mount
  useEffect(() => {
    if (currentSelectNetwork?.networkId) {
      void swapLoadAllNetworkTokenList();
    }
  }, [currentSelectNetwork?.networkId, protocol, swapLoadAllNetworkTokenList]);

  const networkFilterData = useMemo(() => {
    let swapNetworksCommon: ISwapNetwork[] = [];
    let swapNetworksMoreCount;
    if (swapNetworksIncludeAllNetwork && swapNetworksIncludeAllNetwork.length) {
      const networksCount = md
        ? swapNetworksCommonCountMD
        : swapNetworksCommonCount;
      swapNetworksCommon =
        swapNetworksIncludeAllNetwork.length > networksCount
          ? swapNetworksIncludeAllNetwork.slice(0, networksCount)
          : swapNetworksIncludeAllNetwork;
      swapNetworksMoreCount =
        swapNetworksIncludeAllNetwork.length - networksCount > 0
          ? swapNetworksIncludeAllNetwork.length - networksCount
          : undefined;
    }
    return {
      swapNetworksCommon,
      swapNetworksMoreCount,
    };
  }, [md, swapNetworksIncludeAllNetwork]);

  const onSelectCurrentNetwork = useCallback(
    (network: ISwapNetwork) => {
      setCurrentSelectNetwork(network);
      onSelectNetworkId?.(network.networkId);
    },
    [onSelectNetworkId],
  );

  const openChainSelector = useConfigurableChainSelector();

  const handleMoreNetwork = useCallback(() => {
    openChainSelector({
      defaultNetworkId: currentSelectNetwork?.networkId,
      networkIds: swapNetworksIncludeAllNetwork
        .filter((item) => !item.isAllNetworks) // Exclude "All Networks" from selector list
        .map((item) => item.networkId),
      grouped: false,
      onSelect: (network) => {
        if (!network) return;
        const findSwapNetwork = swapNetworksIncludeAllNetwork.find(
          (net) => net.networkId === network.id,
        );
        if (!findSwapNetwork) return;
        onSelectCurrentNetwork(findSwapNetwork);
      },
    });
  }, [
    currentSelectNetwork?.networkId,
    onSelectCurrentNetwork,
    openChainSelector,
    swapNetworksIncludeAllNetwork,
  ]);

  if (!swapNetworksIncludeAllNetwork?.length) {
    // Optionally return a Skeleton or null while networks are loading
    return null;
  }

  return (
    <MarketNetworkFilter
      networks={networkFilterData.swapNetworksCommon}
      selectedNetwork={currentSelectNetwork}
      onSelectNetwork={onSelectCurrentNetwork}
      moreNetworksCount={networkFilterData.swapNetworksMoreCount}
      onMoreNetwork={handleMoreNetwork}
      // Add other props like disableNetworks, disableMoreNetworks if needed later
    />
  );
}

const MarketTokenListNetworkSelectorComponent = memo(
  MarketTokenListNetworkSelector,
);

function MarketTokenListNetworkSelectorWithProvider(
  props: IMarketTokenListNetworkSelectorProps,
) {
  return (
    <SwapProviderMirror storeName={EJotaiContextStoreNames.swapModal}>
      <MarketTokenListNetworkSelectorComponent {...props} />
    </SwapProviderMirror>
  );
}

export default memo(MarketTokenListNetworkSelectorWithProvider);
