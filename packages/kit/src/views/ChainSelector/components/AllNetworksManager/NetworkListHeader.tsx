import { memo, useContext, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, Divider, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

function NetworkListHeader() {
  const intl = useIntl();
  const { networks, enabledNetworks, setNetworksState, searchKey } = useContext(
    AllNetworksManagerContext,
  );

  const isAllNetworksEnabled = useMemo(() => {
    if (enabledNetworks.length > 0) {
      if (enabledNetworks.length === networks.mainNetworks.length) {
        return true;
      }
      return 'indeterminate';
    }
    return false;
  }, [enabledNetworks, networks.mainNetworks]);

  const toggleAllNetworks = useMemo(() => {
    return Object.fromEntries(
      networks.mainNetworks.map((network) => [network.id, true]),
    );
  }, [networks.mainNetworks]);

  return (
    <Stack mt="$4">
      {searchKey?.trim() ? null : (
        <>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_enable_all,
            })}
          >
            <Checkbox
              value={isAllNetworksEnabled}
              onChange={(value) => {
                if (typeof value === 'boolean') {
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
                }
              }}
            />
          </ListItem>
          <Divider m="$5" />
        </>
      )}
    </Stack>
  );
}

export default memo(NetworkListHeader);
