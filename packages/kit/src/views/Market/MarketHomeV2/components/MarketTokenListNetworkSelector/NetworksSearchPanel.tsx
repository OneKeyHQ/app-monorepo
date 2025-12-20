import { useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import { Stack } from '@onekeyhq/components';
import { ChainSelectorListView } from '@onekeyhq/kit/src/views/ChainSelector/components/PureChainSelector/ChainSelectorListView';
import type { IServerNetworkMatch } from '@onekeyhq/kit/src/views/ChainSelector/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export interface INetworksSearchPanelProps
  extends Omit<ComponentProps<typeof ChainSelectorListView>, 'networks'> {
  networks?: IServerNetwork[];
  onNetworkSelect?: (network: IServerNetwork) => void;
}

export const NetworksSearchPanel: FC<INetworksSearchPanelProps> = ({
  networks: networksProp,
  networkId,
  onNetworkSelect,
}) => {
  const networksForListView = useMemo(() => {
    if (!networksProp?.length) return [];
    return networksProp.filter(
      (network): network is IServerNetwork => network !== null,
    ) as IServerNetworkMatch[];
  }, [networksProp]);

  const handleNetworkPress = (network: IServerNetworkMatch) => {
    // Find the original ISwapNetwork to pass back
    if (networksProp && onNetworkSelect) {
      const originalNetwork = networksProp.find((n) => n.id === network.id);

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
