import { memo, useCallback, useState } from 'react';

import { SwapProviderMirror } from '@onekeyhq/kit/src/views/Swap/pages/SwapProviderMirror';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
