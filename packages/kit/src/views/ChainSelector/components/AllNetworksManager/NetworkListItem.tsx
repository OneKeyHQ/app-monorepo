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
      testID={`select-item-${network.id}`}
    >
      <Switch
        size="large"
        value={isEnabledInAllNetworks}
        onChange={(value) => {
          if (value) {
            setNetworksState((prev) => ({
              enabledNetworks: {
                ...prev.enabledNetworks,
                [network.id]: true,
              },
              disabledNetworks: {
                ...prev.disabledNetworks,
                [network.id]: false,
              },
            }));
          } else {
            setNetworksState((prev) => ({
              enabledNetworks: {
                ...prev.enabledNetworks,
                [network.id]: false,
              },
              disabledNetworks: {
                ...prev.disabledNetworks,
                [network.id]: true,
              },
            }));
          }
        }}
      />
    </ListItem>
  );
}

export default memo(NetworkListItem);
