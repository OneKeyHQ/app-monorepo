import { useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import { ChainSelectorListView } from '@onekeyhq/kit/src/views/ChainSelector/components/PureChainSelector/ChainSelectorListView';
import type { IServerNetworkMatch } from '@onekeyhq/kit/src/views/ChainSelector/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

// Convert ISwapNetwork to IServerNetwork format with minimal required properties
const convertSwapNetworkToServerNetwork = (
  swapNetwork: ISwapNetwork,
): IServerNetwork => ({
  // Essential properties for ChainSelectorListView
  id: swapNetwork.networkId,
  name: swapNetwork.name,
  symbol: swapNetwork.symbol || swapNetwork.name.toUpperCase(),
  logoURI: swapNetwork.logoURI || '',
  isAllNetworks: swapNetwork.isAllNetworks,
  // Minimal required properties for type compatibility
  impl: 'evm',
  chainId: swapNetwork.networkId,
  code: swapNetwork.shortcode || swapNetwork.name.toLowerCase(),
  shortname: swapNetwork.name,
  shortcode: swapNetwork.shortcode || swapNetwork.name.toLowerCase(),
  decimals: 18,
  feeMeta: {
    symbol: swapNetwork.symbol || swapNetwork.name.toUpperCase(),
    decimals: 18,
  },
  defaultEnabled: true,
  status: 'LISTED' as any,
  isTestnet: false,
  explorerURL: '',
  isCustomNetwork: false,
});

export interface INetworksSearchPanelProps
  extends Omit<ComponentProps<typeof ChainSelectorListView>, 'networks'> {
  networks?: ISwapNetwork[];
  onNetworkSelect?: (network: ISwapNetwork) => void;
}

export const NetworksSearchPanel: FC<INetworksSearchPanelProps> = ({
  networks: networksProp,
  networkId,
  onPressItem,
  onNetworkSelect,
}) => {
  // Convert ISwapNetwork[] to IServerNetworkMatch[] for ChainSelectorListView
  const networksForListView = useMemo(() => {
    if (!networksProp?.length) return [];
    return networksProp.map(
      convertSwapNetworkToServerNetwork,
    ) as IServerNetworkMatch[];
  }, [networksProp]);

  const handleNetworkPress = (network: IServerNetworkMatch) => {
    // Find the original ISwapNetwork to pass back
    if (networksProp && onNetworkSelect) {
      const originalNetwork = networksProp.find(
        (n) => n.networkId === network.id,
      );
      if (originalNetwork) {
        onNetworkSelect(originalNetwork);
      }
    }
    onPressItem?.(network);
  };

  return (
    <ChainSelectorListView
      networkId={networkId}
      networks={networksForListView}
      onPressItem={handleNetworkPress}
    />
  );
};
