import { memo, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

function NetworkListHeader() {
  const intl = useIntl();
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
    <ListItem
      title={intl.formatMessage({
        id: ETranslations.global_enable_all,
      })}
    >
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
