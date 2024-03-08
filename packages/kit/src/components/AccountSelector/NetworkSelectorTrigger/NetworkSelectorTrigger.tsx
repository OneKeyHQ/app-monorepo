import { memo, useCallback, useMemo } from 'react';

import { Icon, Image, Select, SizableText, XStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorAvailableNetworks } from '../hooks/useAccountSelectorAvailableNetworks';

function useNetworkSelectorItems() {
  const { serviceNetwork } = backgroundApiProxy;

  const allNetworksRes = usePromiseResult(
    () => serviceNetwork.getAllNetworks(),
    [serviceNetwork],
  );
  const items = useMemo(
    () =>
      allNetworksRes.result?.networks.map((item) => ({
        value: item.id,
        label: item.name,
      })) || [],
    [allNetworksRes.result?.networks],
  );

  return items;
}

export function NetworkSelectorTriggerLegacyCmp({ num }: { num: number }) {
  const items = useNetworkSelectorItems();

  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

  useDebugComponentRemountLog({ name: 'NetworkSelectorTriggerLegacy' });

  if (!isReady) {
    return null;
  }

  return (
    <>
      <SizableText size="$headingXl">
        网络选择器 {selectedAccount.networkId}
      </SizableText>
      <Select
        items={items}
        value={selectedAccount.networkId}
        onChange={(id) =>
          actions.current.updateSelectedAccountNetwork({
            num,
            networkId: id,
          })
        }
        title="网络"
      />
    </>
  );
}

export const NetworkSelectorTriggerLegacy = memo(
  NetworkSelectorTriggerLegacyCmp,
);

function NetworkSelectorTriggerHomeCmp({ num }: { num: number }) {
  const {
    activeAccount: { network },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl } = useAccountSelectorSceneInfo();
  const { networkIds, defaultNetworkId } = useAccountSelectorAvailableNetworks({
    num,
  });

  useDebugComponentRemountLog({ name: 'NetworkSelectorTriggerHome' });

  const navigation = useAppNavigation();

  const handleChainPress = useCallback(() => {
    actions.current.showChainSelector({
      navigation,
      num,
      sceneName,
      sceneUrl,
      networkIds,
      defaultNetworkId,
    });
  }, [
    actions,
    defaultNetworkId,
    navigation,
    networkIds,
    num,
    sceneName,
    sceneUrl,
  ]);

  return (
    <XStack
      role="button"
      flexShrink={1}
      alignItems="center"
      p="$1"
      m="$-1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      $platform-native={{
        hitSlop: {
          top: 8,
          bottom: 8,
          left: 8,
        },
      }}
      userSelect="none"
      onPress={handleChainPress}
    >
      {/* TODO NetworkAvatar component */}
      <Image
        w="$5"
        h="$5"
        source={{
          uri: network?.logoURI ? network?.logoURI : '',
        }}
      />
      <SizableText pl="$2" size="$bodyMd" flexShrink={1} numberOfLines={1}>
        {network?.name}
      </SizableText>
      <Icon
        name="ChevronDownSmallOutline"
        color="$iconSubdued"
        size="$5"
        flexShrink={0}
      />
    </XStack>
  );
}
export const NetworkSelectorTriggerHome = memo(NetworkSelectorTriggerHomeCmp);

export function ControlledNetworkSelectorTrigger({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (networkId: string) => void;
}) {
  const items = useNetworkSelectorItems();
  return (
    <Select items={items} value={value} onChange={onChange} title="网络" />
  );
}
