import { memo, useContext } from 'react';

import { Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

import type { IServerNetworkMatch } from '../../types';

function NetworkListItem({ network }: { network: IServerNetworkMatch }) {
  const { networksState, setNetworksState } = useContext(
    AllNetworksManagerContext,
  );

  const isEnabledInAllNetworks = isEnabledNetworksInAllNetworks({
    networkId: network.id,
    disabledNetworks: networksState.disabledNetworks,
    enabledNetworks: networksState.enabledNetworks,
    isTestnet: network.isTestnet,
  });

  return (
    <ListItem
      h={48}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={network.logoURI}
          isCustomNetwork={network.isCustomNetwork}
          networkName={network.name}
          size="$8"
        />
      }
      title={network.name}
      titleMatch={network.titleMatch}
      testID={`all-networks-manager-item-${network.id}`}
    >
      <Switch
        size="small"
        value={isEnabledInAllNetworks}
        onChange={(value) => {
          setNetworksState((prev) => ({
            enabledNetworks: {
              ...prev.enabledNetworks,
              [network.id]: value,
            },
            disabledNetworks: {
              ...prev.disabledNetworks,
              [network.id]: !value,
            },
          }));
        }}
      />
    </ListItem>
  );
}

export default memo(NetworkListItem);
