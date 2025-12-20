import { memo, useContext } from 'react';

import { Checkbox } from '@onekeyhq/components';
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

  const handleToggle = () => {
    setNetworksState((prev) => ({
      enabledNetworks: {
        ...prev.enabledNetworks,
        [network.id]: !isEnabledInAllNetworks,
      },
      disabledNetworks: {
        ...prev.disabledNetworks,
        [network.id]: isEnabledInAllNetworks,
      },
    }));
  };

  return (
    <ListItem
      h="$12"
      py="$0"
      onPress={handleToggle}
      renderAvatar={
        <NetworkAvatarBase
          logoURI={network.logoURI}
          isCustomNetwork={network.isCustomNetwork}
          networkName={network.name}
          isAllNetworks={network.isAllNetworks}
          allNetworksIconProps={{
            color: '$iconActive',
          }}
          size="$8"
        />
      }
      title={network.name}
      titleMatch={network.titleMatch}
      testID={`all-networks-manager-item-${network.id}`}
    >
      <Checkbox value={isEnabledInAllNetworks} onChange={handleToggle} />
    </ListItem>
  );
}

export default memo(NetworkListItem);
