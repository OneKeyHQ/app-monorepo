import { useMemo } from 'react';
import type { ComponentProps, FC } from 'react';

import { ChainSelectorListView } from '@onekeyhq/kit/src/views/ChainSelector/components/PureChainSelector/ChainSelectorListView';
import type { IServerNetworkMatch } from '@onekeyhq/kit/src/views/ChainSelector/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';

// TODO: check IServerNetworkMatch type usage from ChainSelectorListView
// The default swapNetworksIncludeAllNetwork data structure is NOT IServerNetworkMatch[]
// and might cause runtime issues if ChainSelectorListView relies on full IServerNetwork properties.
export interface INetworksSearchPanelProps
  extends Omit<ComponentProps<typeof ChainSelectorListView>, 'networks'> {
  // Allow networks prop to be potentially undefined or IServerNetwork[]
  networks?: IServerNetwork[];
}

export const NetworksSearchPanel: FC<INetworksSearchPanelProps> = ({
  // Use imported data as default for networks prop
  networks: networksProp, // Rename prop to avoid conflict
  networkId,
  onPressItem,
}) => {
  // Use the prop if provided, otherwise use the default swap data
  const networksData = networksProp;

  // Memoize the cast to avoid unnecessary recalculations
  const networksForListView = useMemo(
    () => networksData as IServerNetworkMatch[],
    [networksData],
  );

  return (
    <ChainSelectorListView
      networkId={networkId}
      // Cast the networks data. This resolves the TS error but may hide runtime issues
      // if the component requires full IServerNetwork properties not present in swapNetworksIncludeAllNetwork.
      networks={networksForListView}
      onPressItem={onPressItem}
    />
  );
};
