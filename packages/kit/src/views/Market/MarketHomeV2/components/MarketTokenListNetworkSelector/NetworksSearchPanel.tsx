import { useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import { Stack } from '@onekeyhq/components';
import { ChainSelectorListView } from '@onekeyhq/kit/src/views/ChainSelector/components/PureChainSelector/ChainSelectorListView';
import type { IServerNetworkMatch } from '@onekeyhq/kit/src/views/ChainSelector/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

// Convert ISwapNetwork to IServerNetwork format with minimal required properties
const convertSwapNetworkToServerNetwork = ({
  networkId,
  name,
  symbol,
  logoURI,
  isAllNetworks,
  shortcode,
}: ISwapNetwork): IServerNetwork => ({
  id: networkId,
  name,
  symbol: symbol || name.toUpperCase(),
  logoURI: logoURI || '',
  isAllNetworks,
  // Required properties with minimal defaults
  impl: 'evm' as any,
  chainId: networkId,
  code: shortcode || name.toLowerCase(),
  shortname: name,
  shortcode: shortcode || name.toLowerCase(),
  decimals: 18,
  feeMeta: {
    symbol: symbol || name.toUpperCase(),
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
  };

  return (
    <Stack pt="$4">
      <ChainSelectorListView
        networkId={networkId}
        networks={networksForListView}
        onPressItem={handleNetworkPress}
      />
    </Stack>
  );
};
