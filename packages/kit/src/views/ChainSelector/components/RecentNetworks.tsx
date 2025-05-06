import { memo, useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SectionList,
  SizableText,
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

import { NetworkAvatar } from '../../../components/NetworkAvatar';

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
    <Button
      onPress={handlePress}
      size="small"
      variant="secondary"
      childrenAsText={false}
    >
      <XStack alignItems="center" gap="$2">
        <NetworkAvatar networkId={network.id} size={18} />
        <SizableText textBreakStrategy="simple" size="$bodyMdMedium">
          {network.name}
        </SizableText>
      </XStack>
    </Button>
  );
}

function RecentNetworks({
  onPressItem,
  setRecentNetworksHeight,
  availableNetworks,
}: {
  onPressItem?: (network: IServerNetwork) => void;
  setRecentNetworksHeight?: (height: number) => void;
  availableNetworks?: IServerNetwork[];
}) {
  const intl = useIntl();

  const { result: recentNetworks, run } = usePromiseResult(
    async () => {
      const networks: IServerNetwork[] = [];
      const resp = await backgroundApiProxy.serviceNetwork.getRecentNetworks({
        availableNetworks,
      });
      for (const networkId of resp) {
        try {
          const network = await backgroundApiProxy.serviceNetwork.getNetwork({
            networkId,
          });
          networks.push(network);
        } catch (error) {
          // ignore
        }
      }
      return networks;
    },
    [availableNetworks],
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
