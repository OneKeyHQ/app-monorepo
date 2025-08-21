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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EChainSelectorPages, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { NetworkAvatarBase } from '../NetworkAvatar';

function AllNetworksManagerTrigger({
  num,
  containerProps,
  showSkeleton,
}: {
  num: number;
  containerProps?: ComponentProps<typeof Stack>;
  showSkeleton?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    activeAccount: { network, wallet, account, indexedAccount },
  } = useActiveAccount({ num });

  const {
    enabledNetworksCompatibleWithWalletId,
    enabledNetworksWithoutAccount,
    run,
  } = useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
    walletId: wallet?.id ?? '',
    networkId: network?.id,
    indexedAccountId: indexedAccount?.id,
    filterNetworksWithoutAccount: true,
  });

  useEffect(() => {
    const refresh = async () => {
      await run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
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
    // TODO: Remove this after the native Android layout reset fixed.
    if (platformEnv.isNativeAndroid) {
      return <Stack height={5} />;
    }

    return null;
  }

  if (
    showSkeleton ||
    !enabledNetworksCompatibleWithWalletId ||
    enabledNetworksCompatibleWithWalletId.length === 0
  ) {
    return (
      <Stack py="$1">
        <Skeleton.BodyMd />
      </Stack>
    );
  }

  return (
    <YStack alignSelf="flex-start" ml="$-1">
      <XStack
        borderRadius="$2"
        hoverStyle={{
          bg: '$bgHover',
        }}
        p="$1"
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
                <NetworkAvatarBase logoURI={item?.logoURI} size="$5" />
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
        {enabledNetworksWithoutAccount.length > 0 ? (
          <Stack
            position="absolute"
            right="$0"
            top="$0"
            alignItems="flex-end"
            w="$3"
            pointerEvents="none"
          >
            <Stack
              bg="$bgApp"
              borderRadius="$full"
              borderWidth={2}
              borderColor="$transparent"
            >
              <Stack
                px="$1"
                borderRadius="$full"
                bg="$caution10"
                minWidth="$2"
                height="$2"
                alignItems="center"
                justifyContent="center"
              />
            </Stack>
          </Stack>
        ) : null}
      </XStack>
    </YStack>
  );
}

export { AllNetworksManagerTrigger };
