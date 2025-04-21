import { memo, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Divider, Stack, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useTimeout } from '@onekeyhq/kit/src/hooks/useTimeout';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AllNetworksManagerContext } from './AllNetworksManagerContext';

function NetworkListHeader() {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(true);
  const { networks, enabledNetworks, setNetworksState, searchKey } = useContext(
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

  useTimeout(() => {
    setIsLoading(false);
  }, 100);

  return (
    <Stack mt="$4">
      {searchKey?.trim() ? null : (
        <>
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.global_enable_all,
            })}
          >
            <Switch
              size="small"
              value={isAllNetworksEnabled}
              {...(isLoading
                ? {
                    thumbProps: {
                      animation: '0ms',
                    },
                  }
                : {})}
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
          <Divider m="$5" />
        </>
      )}
    </Stack>
  );
}

export default memo(NetworkListHeader);
