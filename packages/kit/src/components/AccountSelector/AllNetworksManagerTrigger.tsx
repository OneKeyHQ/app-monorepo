import type { ComponentProps } from 'react';
import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EChainSelectorPages, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { NetworkAvatar } from '../NetworkAvatar';

function AllNetworksManagerTrigger({
  num,
  containerProps,
}: {
  num: number;
  containerProps?: ComponentProps<typeof Stack>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    activeAccount: { network, wallet, account, indexedAccount },
  } = useActiveAccount({ num });

  const { enabledNetworksCompatibleWithWalletId, run } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId: wallet?.id ?? '',
      networkId: network?.id,
    });

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, run);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, run);
    };
  }, [run]);

  const handleOnPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.AllNetworksManager,
      params: {
        walletId: wallet?.id ?? '',
        accountId: account?.id,
        indexedAccountId: indexedAccount?.id,
        onNetworksChanged: async () => {
          void run({ alwaysSetState: true });
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        },
      },
    });
  }, [navigation, wallet?.id, account?.id, indexedAccount?.id, run]);

  if (
    !networkUtils.isAllNetwork({ networkId: network?.id }) ||
    accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
  ) {
    return null;
  }

  if (
    !enabledNetworksCompatibleWithWalletId ||
    enabledNetworksCompatibleWithWalletId.length === 0
  ) {
    return <Skeleton h={20} w={120} />;
  }

  return (
    <YStack m="$-1" alignSelf="flex-start">
      <XStack
        borderRadius="$2"
        p="$1"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusable
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
        }}
        userSelect="none"
        onPress={handleOnPress}
        gap="$1"
      >
        <XStack my="$-0.5">
          {enabledNetworksCompatibleWithWalletId
            ?.slice(0, 3)
            .map((item, index) => (
              <Stack
                key={index}
                borderWidth={2}
                borderColor="$bgApp"
                borderRadius="$full"
                zIndex={index}
                {...(index !== 0 && {
                  ml: '$-2',
                })}
              >
                <NetworkAvatar networkId={item?.id} size="$5" />
              </Stack>
            ))}
          {enabledNetworksCompatibleWithWalletId.length > 3 ? (
            <XStack
              px="$1"
              py="$0.5"
              bg="$gray5"
              borderRadius="$full"
              ml="$-2"
              zIndex={999}
              borderWidth={2}
              borderColor="$bgApp"
            >
              <SizableText size="$bodySm">
                +{enabledNetworksCompatibleWithWalletId.length - 3}
              </SizableText>
            </XStack>
          ) : null}
        </XStack>
        <XStack>
          <SizableText size="$bodyMd">
            {intl.formatMessage(
              { id: ETranslations.global_count_networks },
              {
                count: enabledNetworksCompatibleWithWalletId.length,
              },
            )}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
        </XStack>
      </XStack>
    </YStack>
  );
}

export { AllNetworksManagerTrigger };
