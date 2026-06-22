import { useCallback, useMemo, useState } from 'react';
import type { ComponentProps, FC } from 'react';

import { Stack } from '@onekeyhq/components';
import { ChainSelectorListView } from '@onekeyhq/kit/src/views/ChainSelector/components/PureChainSelector/ChainSelectorListView';
import {
  CELL_HEIGHT,
  type IServerNetworkMatch,
} from '@onekeyhq/kit/src/views/ChainSelector/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

export const NETWORKS_SEARCH_PANEL_MAX_HEIGHT = 420;
export const NETWORKS_SEARCH_PANEL_FOCUSED_HEIGHT_REDUCTION = 100;

const NETWORKS_SEARCH_PANEL_BASE_HEIGHT = 92;

export interface INetworksSearchPanelProps extends Omit<
  ComponentProps<typeof ChainSelectorListView>,
  'networks' | 'onSearchFocusChange'
> {
  networks?: IServerNetwork[];
  focusedPanelHeightReduction?: number;
  onNetworkSelect?: (network: IServerNetwork) => void;
}

export const NetworksSearchPanel: FC<INetworksSearchPanelProps> = ({
  networks: networksProp,
  networkId,
  isOpen,
  focusedPanelHeightReduction = 0,
  onNetworkSelect,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const networksForListView = useMemo(() => {
    if (!networksProp?.length) return [];
    return networksProp.filter(
      (network): network is IServerNetwork => network !== null,
    ) as IServerNetworkMatch[];
  }, [networksProp]);

  const panelMaxHeight =
    isSearchFocused && focusedPanelHeightReduction > 0
      ? NETWORKS_SEARCH_PANEL_MAX_HEIGHT - focusedPanelHeightReduction
      : NETWORKS_SEARCH_PANEL_MAX_HEIGHT;

  const panelHeight = useMemo(
    () =>
      Math.min(
        panelMaxHeight,
        NETWORKS_SEARCH_PANEL_BASE_HEIGHT +
          networksForListView.length * CELL_HEIGHT,
      ),
    [panelMaxHeight, networksForListView.length],
  );

  const handleSearchFocusChange = useCallback((isFocused: boolean) => {
    setIsSearchFocused(isFocused);
  }, []);

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
        onSearchFocusChange={handleSearchFocusChange}
      />
    </Stack>
  );
};
