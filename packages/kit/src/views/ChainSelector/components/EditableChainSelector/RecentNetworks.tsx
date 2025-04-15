import { memo, useCallback, useContext, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SectionList,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EditableChainSelectorContext } from './context';

import type { LayoutChangeEvent } from 'react-native';

function RecentNetworkItem({
  network,
  onPressItem,
}: {
  network: IServerNetwork;
  onPressItem?: (network: IServerNetwork) => void;
}) {
  const handlePress = useCallback(() => {
    if (network) {
      onPressItem?.(network);
    }
  }, [onPressItem, network]);
  return (
    <Button onPress={handlePress} size="small" variant="secondary">
      {network.name}
    </Button>
  );
}

function RecentNetworks() {
  const intl = useIntl();

  const { onPressItem, setRecentNetworksHeight } = useContext(
    EditableChainSelectorContext,
  );

  const { result: recentNetworks, run } = usePromiseResult(
    async () => {
      const networks: IServerNetwork[] = [];
      const resp = await backgroundApiProxy.serviceNetwork.getRecentNetworks();
      for (const networkId of resp) {
        const network = await backgroundApiProxy.serviceNetwork.getNetwork({
          networkId,
        });
        networks.push(network);
      }
      return networks;
    },
    [],
    {
      initResult: [],
    },
  );

  const handleClearRecentNetworks = useCallback(async () => {
    await backgroundApiProxy.serviceNetwork.clearRecentNetworks();
    void run();
  }, [run]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setRecentNetworksHeight?.(event.nativeEvent.layout.height);
    },
    [setRecentNetworksHeight],
  );

  useEffect(() => {
    const fn = async () => {
      await run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [run]);

  return (
    <Stack onLayout={handleLayout}>
      {recentNetworks.length > 0 ? (
        <>
          <SectionList.SectionHeader
            title={intl.formatMessage({
              id: ETranslations.network_recent_used_network,
            })}
          >
            <XStack justifyContent="flex-end" flex={1}>
              <IconButton
                size="small"
                variant="tertiary"
                icon="DeleteOutline"
                onPress={handleClearRecentNetworks}
              />
            </XStack>
          </SectionList.SectionHeader>
          <XStack flex={1} gap="$2.5" flexWrap="wrap" px="$5" pb="$5">
            {recentNetworks.map((network) => (
              <RecentNetworkItem
                key={network.id}
                network={network}
                onPressItem={onPressItem}
              />
            ))}
          </XStack>
        </>
      ) : null}
    </Stack>
  );
}

export default memo(RecentNetworks);
