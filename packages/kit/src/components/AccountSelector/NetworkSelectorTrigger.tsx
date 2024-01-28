import { useCallback, useMemo } from 'react';

import { Icon, Image, Select, SizableText, XStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { useNetworkAutoSelect } from './hooks/useNetworkAutoSelect';

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

export function NetworkSelectorTriggerLegacy({ num }: { num: number }) {
  const items = useNetworkSelectorItems();
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

  useNetworkAutoSelect({ num });

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
          actions.current.updateSelectedAccount({
            num,
            builder: (v) => ({
              ...v,
              networkId: id,
            }),
          })
        }
        title="网络"
      />
    </>
  );
}

export function NetworkSelectorTriggerHome({ num }: { num: number }) {
  const {
    activeAccount: { network },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const { sceneName, sceneUrl, networks, defaultNetworkId } =
    useAccountSelectorSceneInfo();

  useNetworkAutoSelect({ num });

  const navigation = useAppNavigation();

  const handleChainPress = useCallback(() => {
    actions.current.showChainSelector({
      navigation,
      num,
      sceneName,
      sceneUrl,
      networks,
      defaultNetworkId,
    });
  }, [
    actions,
    defaultNetworkId,
    navigation,
    networks,
    num,
    sceneName,
    sceneUrl,
  ]);

  return (
    <XStack
      alignItems="center"
      onPress={handleChainPress}
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
    >
      {/* TODO NetworkAvatar component */}
      <Image
        w="$5"
        h="$5"
        source={{
          uri: network?.logoURI ? network?.logoURI : '',
        }}
      />
      <SizableText
        userSelect="none"
        pl="$2"
        size="$bodyMd"
        color="$textSubdued"
      >
        {network?.name}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
    </XStack>
  );
}

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
