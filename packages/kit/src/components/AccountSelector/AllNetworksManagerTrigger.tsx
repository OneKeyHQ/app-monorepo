import type { ComponentProps } from 'react';
import { useCallback, useEffect } from 'react';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EChainSelectorPages, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { NetworkAvatarBase } from '../NetworkAvatar';

import { useUnifiedNetworkSelectorTrigger } from './hooks/useUnifiedNetworkSelectorTrigger';

const MAX_DISPLAY_NETWORKS = 2;

function AllNetworksManagerTrigger({
  num,
  showSkeleton,
  unifiedMode = false,
}: {
  num: number;
  containerProps?: ComponentProps<typeof Stack>;
  showSkeleton?: boolean;
  unifiedMode?: boolean;
}) {
  const navigation = useAppNavigation();
  const {
    activeAccount: { network, wallet, account, indexedAccount },
  } = useActiveAccount({ num });

  const { showUnifiedNetworkSelector } = useUnifiedNetworkSelectorTrigger({
    num,
  });

  const shouldEnableCompatQuery =
    Boolean(network?.id) &&
    networkUtils.isAllNetwork({ networkId: network?.id }) &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' });

  // SWR cache in usePromiseResult provides instant cold-start data,
  // so deferHeavyWorkUntilUIIdle is no longer needed here.
  const compatQueryWalletId = shouldEnableCompatQuery ? (wallet?.id ?? '') : '';

  const {
    enabledNetworksCompatibleWithWalletId,
    enabledNetworksWithoutAccount,
    run,
  } = useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
    walletId: compatQueryWalletId,
    networkId: network?.id,
    indexedAccountId: indexedAccount?.id,
    filterNetworksWithoutAccount: true,
  });

  useEffect(() => {
    const refresh = async () => {
      try {
        await run({ alwaysSetState: true });
      } catch {
        // silently ignore refresh errors
      }
    };
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
    };
  }, [run]);

  const handleOnPress = useCallback(() => {
    if (unifiedMode) {
      showUnifiedNetworkSelector({
        recordNetworkHistoryEnabled: true,
        defaultTab: 'portfolio',
      });
      return;
    }
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
  }, [
    navigation,
    wallet?.id,
    account?.id,
    indexedAccount?.id,
    run,
    unifiedMode,
    showUnifiedNetworkSelector,
  ]);

  if (!wallet) {
    return null;
  }

  if (
    !networkUtils.isAllNetwork({ networkId: network?.id }) ||
    accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
  ) {
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
    return <Stack h={36} />;
  }

  return (
    <XStack
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
      userSelect="none"
      onPress={handleOnPress}
      alignItems="center"
    >
      <XStack alignItems="center">
        {enabledNetworksCompatibleWithWalletId
          ?.slice(0, MAX_DISPLAY_NETWORKS)
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
              <NetworkAvatarBase
                logoURI={item?.logoURI}
                size="$6"
                networkName={item?.name}
                isCustomNetwork={item?.isCustomNetwork}
              />
            </Stack>
          ))}
        {enabledNetworksCompatibleWithWalletId.length > MAX_DISPLAY_NETWORKS ? (
          <XStack
            px="$1"
            bg="$gray5"
            borderRadius="$full"
            ml="$-2"
            zIndex={999}
            borderWidth={2}
            borderColor="$bgApp"
            alignItems="center"
            justifyContent="center"
            h={28}
          >
            <SizableText size="$bodySm">
              +
              {enabledNetworksCompatibleWithWalletId.length -
                MAX_DISPLAY_NETWORKS}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
      <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
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
  );
}

export { AllNetworksManagerTrigger };
