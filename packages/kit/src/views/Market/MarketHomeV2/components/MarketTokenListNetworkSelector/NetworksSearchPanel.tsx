import { useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import { ChainSelectorListView } from '@onekeyhq/kit/src/views/ChainSelector/components/PureChainSelector/ChainSelectorListView';
import type { IServerNetworkMatch } from '@onekeyhq/kit/src/views/ChainSelector/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

// Convert ISwapNetwork to IServerNetwork format
// Note: Many properties are redundant for ChainSelectorListView usage but required by IServerNetwork type
const convertSwapNetworkToServerNetwork = (
  swapNetwork: ISwapNetwork,
): IServerNetwork => ({
  // Essential properties actually used by ChainSelectorListView
  id: swapNetwork.networkId,
  name: swapNetwork.name,
  symbol: swapNetwork.symbol,
  logoURI: swapNetwork.logoURI || '',
  isAllNetworks: swapNetwork.isAllNetworks,
  // Required by IServerNetwork type but mostly unused in this context
  impl: 'evm',
  chainId: swapNetwork.networkId, // Duplicates id but required
  code: swapNetwork.shortcode || swapNetwork.name.toLowerCase(),
  shortname: swapNetwork.name, // Duplicates name but required
  shortcode: swapNetwork.shortcode || swapNetwork.name.toLowerCase(), // Duplicates code but required
  decimals: 18,
  feeMeta: { symbol: swapNetwork.symbol, decimals: 18 },
  defaultEnabled: true,
  status: 'LISTED' as any,
  isTestnet: false,
  explorerURL: '',
  isCustomNetwork: false,
});

export interface INetworksSearchPanelProps
  extends Omit<ComponentProps<typeof ChainSelectorListView>, 'networks'> {
  // Only support ISwapNetwork[]
  networks?: ISwapNetwork[];
  // Add callback for network selection
  onNetworkSelect?: (network: ISwapNetwork) => void;
}

export const NetworksSearchPanel: FC<INetworksSearchPanelProps> = ({
  networks: networksProp,
  networkId,
  onPressItem,
  onNetworkSelect,
}) => {
  // Convert ISwapNetwork[] to IServerNetwork[] format for ChainSelectorListView
  const networksForListView = useMemo(() => {
    if (!networksProp || networksProp.length === 0) {
      return [];
    }

    // Convert ISwapNetwork[] to IServerNetwork[]
    return networksProp.map(convertSwapNetworkToServerNetwork);
  }, [networksProp]);

  // Cast to IServerNetworkMatch[] for ChainSelectorListView
  const networksAsMatches = useMemo(
    () => networksForListView as IServerNetworkMatch[],
    [networksForListView],
  );

  const handleNetworkPress = (network: IServerNetworkMatch) => {
    // Find the original ISwapNetwork data to pass back
    if (networksProp && onNetworkSelect) {
      const originalNetwork = networksProp.find(
        (n) => n.networkId === network.id,
      );
      if (originalNetwork) {
        onNetworkSelect(originalNetwork);
      }
    }

    // Also call the original onPressItem if provided
    onPressItem?.(network);
  };

  return (
    <ChainSelectorListView
      networkId={networkId}
      networks={networksAsMatches}
      onPressItem={handleNetworkPress}
    />
  );
};
