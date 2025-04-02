import { memo, useContext, useMemo } from 'react';

import { Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

function NetworkListHeader() {
  const { networks, enabledNetworks, setNetworksState } = useContext(
    AllNetworksManagerContext,
  );

  const isAllNetworksEnabled = useMemo(() => {
    return (
      enabledNetworks.length > 0 &&
      enabledNetworks.length === networks.mainNetworks.length
    );
  }, [enabledNetworks, networks.mainNetworks]);

  const toggleAllNetworks = useMemo(() => {
    return Object.fromEntries(
      networks.mainNetworks.map((network) => [network.id, true]),
    );
  }, [networks.mainNetworks]);

  return (
    <ListItem title="Enable all">
      <Switch
        value={isAllNetworksEnabled}
        onChange={(value) => {
          if (value) {
            setNetworksState({
              enabledNetworks: toggleAllNetworks,
              disabledNetworks: {},
            });
          } else {
            setNetworksState({
              enabledNetworks: {},
              disabledNetworks: toggleAllNetworks,
            });
          }
        }}
      />
    </ListItem>
  );
}

export default memo(NetworkListHeader);
