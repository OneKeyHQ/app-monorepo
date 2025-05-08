import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  NATIVE_HIT_SLOP,
  SizableText,
  Stack,
  XStack,
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

function AllNetworksManagerTrigger({ num }: { num: number }) {
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

  return (
    <XStack alignItems="center" gap="$1">
      <XStack alignItems="center">
        <XStack role="button">
          {enabledNetworksCompatibleWithWalletId
            ?.slice(0, 3)
            .map((item, index) => (
              <Stack
                key={index}
                borderWidth={2}
                borderColor="$bgApp"
                borderRadius="$full"
                ml="$-1.5"
                zIndex={index}
              >
                <NetworkAvatar networkId={item?.id} size="$5" />
              </Stack>
            ))}
          {enabledNetworksCompatibleWithWalletId.length > 3 ? (
            <XStack
              px="$1.5"
              borderWidth={2}
              borderColor="$bgApp"
              bg="$gray5"
              borderRadius="$full"
              ml="$-1.5"
              alignItems="center"
              zIndex={999}
            >
              <SizableText size="$bodyMd" color="$text" userSelect="none">
                +{enabledNetworksCompatibleWithWalletId.length - 3}
              </SizableText>
            </XStack>
          ) : null}
        </XStack>
      </XStack>
      <XStack
        role="button"
        flexShrink={1}
        alignItems="center"
        p="$1"
        borderRadius="$2"
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
        hitSlop={NATIVE_HIT_SLOP}
        userSelect="none"
        onPress={handleOnPress}
      >
        <SizableText size="$bodyMd" flexShrink={1} numberOfLines={1}>
          {intl.formatMessage(
            { id: ETranslations.global_count_networks },
            {
              count: enabledNetworksCompatibleWithWalletId.length,
            },
          )}
        </SizableText>
        <Icon
          name="ChevronDownSmallOutline"
          color="$iconSubdued"
          size="$5"
          flexShrink={0}
        />
      </XStack>
    </XStack>
  );
}

export { AllNetworksManagerTrigger };
