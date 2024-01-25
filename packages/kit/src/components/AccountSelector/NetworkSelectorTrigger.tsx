import { useCallback } from 'react';

import { Icon, Image, Select, SizableText, XStack } from '@onekeyhq/components';
import { mockPresetNetworksList } from '@onekeyhq/kit-bg/src/mock';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import useAppNavigation from '../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useAccountSelectorSceneInfo,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

import { useNetworkAutoSelect } from './hooks/useNetworkAutoSelect';

import type { IAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';

const getNetworksItems = memoFn(() =>
  // TODO ETC network
  mockPresetNetworksList.map((item) => ({
    value: item.id,
    label: item.name,
  })),
);

export function NetworkSelectorTriggerLegacy({ num }: { num: number }) {
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
        items={getNetworksItems()}
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
  return (
    <Select
      items={getNetworksItems()}
      value={value}
      onChange={onChange}
      title="网络"
    />
  );
}
