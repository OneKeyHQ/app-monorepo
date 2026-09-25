import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

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
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../hooks/useAllNetwork';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { deferHeavyWorkUntilUIIdle } from '../../utils/deferHeavyWork';
import { NetworkAvatarBase } from '../NetworkAvatar';

import { useUnifiedNetworkSelectorTrigger } from './hooks/useUnifiedNetworkSelectorTrigger';

const MAX_DISPLAY_NETWORKS = 2;

// Set once the first missing-address query after launch has waited for the UI
// to settle. Later runs (remounts, focus, explicit refreshes) go straight to
// the background.
let missingAddressQueryDeferredSinceLaunch = false;

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

  // The wallet-scoped query paints from the SWR cache on a cold start, so it
  // does not wait for the UI; only the first missing-address query after
  // launch does (see below).
  const compatQueryWalletId = shouldEnableCompatQuery ? (wallet?.id ?? '') : '';

  // The avatars and the "+N" count depend only on the wallet and the global
  // enabled-network set, so they come from a wallet-scoped query whose cache
  // key survives account switches inside the wallet. Only the missing-address
  // dot is per account. Keyed per account, every switch to an account without
  // a cached entry (first visit, or evicted by an enabled-set change) painted
  // an empty chip until the query returned.
  const {
    enabledNetworksCompatibleWithWalletId,
    isReady: isCompatQueryReady,
    run: runWalletCompatQuery,
  } = useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
    walletId: compatQueryWalletId,
    networkId: network?.id,
  });

  // The dot reuses the wallet-scoped network list and asks the background only
  // for the per-account part; a second full compat query would repeat the
  // network list and compatibility walk on every switch, focus and refresh.
  const indexedAccountId = indexedAccount?.id ?? '';
  const walletCompatNetworkIds = useMemo(
    () => enabledNetworksCompatibleWithWalletId.map((item) => item.id),
    [enabledNetworksCompatibleWithWalletId],
  );
  const walletCompatNetworkIdsKey = walletCompatNetworkIds.join(',');
  const { result: networkIdsWithoutAccount, run: runMissingAddressQuery } =
    usePromiseResult(
      async () => {
        if (!compatQueryWalletId || !indexedAccountId || !isCompatQueryReady) {
          // Not persisted: the per-account cache keeps the last known dot.
          return undefined;
        }
        if (!missingAddressQueryDeferredSinceLaunch) {
          // Claimed before waiting so runs started meanwhile (remounts,
          // explicit refreshes) do not wait too.
          missingAddressQueryDeferredSinceLaunch = true;
          // The first query after launch starts during the cold start, while
          // the dot's cached value is on screen and e.g. the account selector
          // may be opening; let those frames and requests go first. Only this
          // run waits: a deferred run that outlives its mount drops its result
          // (and cache write), and explicit refreshes must not be delayed.
          await deferHeavyWorkUntilUIIdle();
        }
        return backgroundApiProxy.serviceAllNetwork.getNetworkIdsWithoutAccountInIndexedAccount(
          {
            indexedAccountId,
            networkIds: walletCompatNetworkIds,
          },
        );
      },
      // walletCompatNetworkIds is tracked through its key.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        compatQueryWalletId,
        indexedAccountId,
        isCompatQueryReady,
        walletCompatNetworkIdsKey,
      ],
      {
        revalidateOnFocus: true,
        swrKey:
          compatQueryWalletId && indexedAccountId
            ? swrKeys.allNetworksWithoutAccount({
                walletId: compatQueryWalletId,
                indexedAccountId,
              })
            : undefined,
      },
    );
  const hasNetworksWithoutAccount = (networkIdsWithoutAccount?.length ?? 0) > 0;

  const run = useCallback(
    async (config?: { alwaysSetState?: boolean }) => {
      await Promise.all([
        runWalletCompatQuery(config),
        runMissingAddressQuery(config),
      ]);
    },
    [runWalletCompatQuery, runMissingAddressQuery],
  );

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
    !isCompatQueryReady ||
    !enabledNetworksCompatibleWithWalletId
  ) {
    return <Stack h={36} />;
  }

  if (enabledNetworksCompatibleWithWalletId.length === 0) {
    // Dead-end escape hatch: none of the enabled All Networks chains is
    // compatible with this wallet, so there are no network avatars to show.
    // Keep the trigger pressable so the user can still open the network
    // selector and switch to a single chain (or enable a compatible one).
    return (
      <XStack
        testID="all-networks-manager-trigger"
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
        <NetworkAvatarBase
          logoURI={network?.logoURI ?? ''}
          size="$6"
          networkName={network?.name}
          isAllNetworks={network?.isAllNetworks}
        />
        <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
      </XStack>
    );
  }

  return (
    <XStack
      testID="all-networks-manager-trigger"
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
      {hasNetworksWithoutAccount ? (
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
