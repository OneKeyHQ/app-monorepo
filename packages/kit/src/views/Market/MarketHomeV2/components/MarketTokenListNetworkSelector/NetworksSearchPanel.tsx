import { useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import { Stack } from '@onekeyhq/components';
import { ChainSelectorListView } from '@onekeyhq/kit/src/views/ChainSelector/components/PureChainSelector/ChainSelectorListView';
import {
  CELL_HEIGHT,
  type IServerNetworkMatch,
} from '@onekeyhq/kit/src/views/ChainSelector/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export const NETWORKS_SEARCH_PANEL_MAX_HEIGHT = 420;

const NETWORKS_SEARCH_PANEL_BASE_HEIGHT = 92;

export interface INetworksSearchPanelProps extends Omit<
  ComponentProps<typeof ChainSelectorListView>,
  'networks'
> {
  networks?: IServerNetwork[];
  onNetworkSelect?: (network: IServerNetwork) => void;
}

export const NetworksSearchPanel: FC<INetworksSearchPanelProps> = ({
  networks: networksProp,
  networkId,
  isOpen,
  onNetworkSelect,
}) => {
  const networksForListView = useMemo(() => {
    if (!networksProp?.length) return [];
    return networksProp.filter(
      (network): network is IServerNetwork => network !== null,
    ) as IServerNetworkMatch[];
  }, [networksProp]);

  const panelHeight = useMemo(
    () =>
      Math.min(
        NETWORKS_SEARCH_PANEL_MAX_HEIGHT,
        NETWORKS_SEARCH_PANEL_BASE_HEIGHT +
          networksForListView.length * CELL_HEIGHT,
      ),
    [networksForListView.length],
  );

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
    <Stack pt="$3" h={panelHeight} minHeight={0}>
      <ChainSelectorListView
        isOpen={isOpen}
        networkId={networkId}
        networks={networksForListView}
        onPressItem={handleNetworkPress}
      />
    </Stack>
  );
};
