import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
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
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../hooks/useAllNetwork';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { deferHeavyWorkUntilUIIdle } from '../../utils/deferHeavyWork';
import { NetworkAvatarBase } from '../NetworkAvatar';

import {
  DESKTOP_HEADER_TRIGGER_PROPS,
  DESKTOP_HEADER_TRIGGER_SHAPE,
  DesktopHeaderHitArea,
  handleDesktopHeaderKeyDown,
} from './AccountSelectorTrigger/AccountSelectorTriggerBase';
import { useUnifiedNetworkSelectorTrigger } from './hooks/useUnifiedNetworkSelectorTrigger';
import { AccountSelectorTestIDs } from './testIDs';

const MAX_DISPLAY_NETWORKS = 2;

// Desktop header: the 28 chips (24 logo + 2 gap) sit 2 inside the 32 hover
// shape. Each chip cuts the next one's outline (a circle of 14 whose center
// is 34 in) out of itself instead of drawing a ring in the page color, which
// showed as a white edge on the hover background.
const DESKTOP_NETWORK_TRIGGER_PROPS: IXStackProps = {
  ...DESKTOP_HEADER_TRIGGER_PROPS,
  py: '$0.5',
  my: '$-0.5',
};
const NETWORK_CHIP_CUTOUT =
  'radial-gradient(circle at 34px 14px, transparent 13.5px, #000 14px)';
const NETWORK_CHIP_CUTOUT_STYLE = {
  maskImage: NETWORK_CHIP_CUTOUT,
  WebkitMaskImage: NETWORK_CHIP_CUTOUT,
};
// The +N count keeps its fill inside the see-through ring, 24 high like the
// logos; a fill under the ring would make it read 28.
const NETWORK_COUNT_CHIP_STYLE = { backgroundClip: 'padding-box' };
// A static count: equal-width digits would pad the narrow "1" out to the
// width of "7" and leave "+17" looking loosely spaced.
const PROPORTIONAL_NUMS: ['proportional-nums'] = ['proportional-nums'];

// Same size as the loaded chips, so the copy button and the page below do not
// move when the networks arrive (only shown without a cached list).
function DesktopNetworksSkeleton() {
  return (
    <XStack
      {...DESKTOP_HEADER_TRIGGER_SHAPE}
      py="$0.5"
      my="$-0.5"
      alignItems="center"
    >
      <Stack p="$0.5" style={NETWORK_CHIP_CUTOUT_STYLE}>
        <Skeleton w="$6" h="$6" radius="round" />
      </Stack>
      <Stack p="$0.5" ml="$-2" style={NETWORK_CHIP_CUTOUT_STYLE}>
        <Skeleton w="$6" h="$6" radius="round" />
      </Stack>
      <Stack p="$0.5" ml="$-2">
        <Skeleton w="$8" h="$6" radius="round" />
      </Stack>
      <Stack w="$5" h="$5" />
    </XStack>
  );
}

// Set once the first missing-address query after launch has waited for the UI
// to settle. Later runs (remounts, focus, explicit refreshes) go straight to
// the background.
let missingAddressQueryDeferredSinceLaunch = false;

function AllNetworksManagerTrigger({
  num,
  showSkeleton,
  unifiedMode = false,
  desktopHeader = false,
}: {
  num: number;
  containerProps?: ComponentProps<typeof Stack>;
  showSkeleton?: boolean;
  unifiedMode?: boolean;
  desktopHeader?: boolean;
}) {
  const intl = useIntl();
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
    return desktopHeader ? <DesktopNetworksSkeleton /> : <Stack h={36} />;
  }

  const desktopTriggerProps: IXStackProps | undefined = desktopHeader
    ? {
        ...DESKTOP_NETWORK_TRIGGER_PROPS,
        onKeyDown: (event: { key: string; preventDefault: () => void }) =>
          handleDesktopHeaderKeyDown(event, handleOnPress),
      }
    : undefined;
  const hitArea = desktopHeader ? <DesktopHeaderHitArea /> : null;

  if (enabledNetworksCompatibleWithWalletId.length === 0) {
    // Dead-end escape hatch: none of the enabled All Networks chains is
    // compatible with this wallet, so there are no network avatars to show.
    // Keep the trigger pressable so the user can still open the network
    // selector and switch to a single chain (or enable a compatible one).
    return (
      <XStack
        testID={AccountSelectorTestIDs.allNetworksTrigger}
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
        {...desktopTriggerProps}
        aria-label={
          desktopHeader
            ? intl.formatMessage({ id: ETranslations.global_all_networks })
            : undefined
        }
      >
        {hitArea}
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

  const shownNetworks = enabledNetworksCompatibleWithWalletId.slice(
    0,
    MAX_DISPLAY_NETWORKS,
  );
  const hiddenCount =
    enabledNetworksCompatibleWithWalletId.length - MAX_DISPLAY_NETWORKS;
  const cutChips = desktopHeader && !platformEnv.isNative;
  const chipRing = desktopHeader ? '$transparent' : '$bgApp';
  const missingCount = networkIdsWithoutAccount?.length ?? 0;
  // Hover or keyboard focus explains the trigger: which networks are on, and
  // the dot's meaning when some lack an address for this account.
  const missingText = intl.formatMessage(
    { id: ETranslations.current_account_missing_addresses },
    { count: missingCount },
  );
  const tooltipText = hasNetworksWithoutAccount
    ? missingText
    : intl.formatMessage({ id: ETranslations.global_all_networks });
  const desktopLabel = [
    intl.formatMessage(
      { id: ETranslations.network_view_assets_from_n_networks },
      { count: enabledNetworksCompatibleWithWalletId.length },
    ),
    hasNetworksWithoutAccount ? missingText : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  const trigger = (
    <XStack
      testID={AccountSelectorTestIDs.allNetworksTrigger}
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
      {...desktopTriggerProps}
      aria-label={desktopHeader ? desktopLabel : undefined}
    >
      {hitArea}
      <XStack alignItems="center">
        {shownNetworks.map((item, index) => (
          <Stack
            key={index}
            borderWidth={2}
            borderColor={chipRing}
            borderRadius="$full"
            zIndex={index}
            {...(index !== 0 && {
              ml: '$-2',
            })}
            style={
              cutChips && (index < shownNetworks.length - 1 || hiddenCount > 0)
                ? NETWORK_CHIP_CUTOUT_STYLE
                : undefined
            }
          >
            <NetworkAvatarBase
              logoURI={item?.logoURI}
              size="$6"
              networkName={item?.name}
              isCustomNetwork={item?.isCustomNetwork}
            />
          </Stack>
        ))}
        {hiddenCount > 0 ? (
          <XStack
            // One less on the "+" side, one more on the digits' side: reads
            // centered in the pill.
            pl={5}
            pr={7}
            bg="$gray5"
            borderRadius="$full"
            ml="$-2"
            zIndex={shownNetworks.length}
            borderWidth={2}
            borderColor={chipRing}
            alignItems="center"
            justifyContent="center"
            h={28}
            style={cutChips ? NETWORK_COUNT_CHIP_STYLE : undefined}
          >
            <SizableText size="$bodySm" fontVariant={PROPORTIONAL_NUMS}>
              +{hiddenCount}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
      <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$5" />
      {hasNetworksWithoutAccount && desktopHeader ? (
        // App warning color (as in the network picker); it never overlaps the
        // chevron glyph, so it needs no ring.
        <Stack
          position="absolute"
          top="$1"
          right="$1"
          w="$2"
          h="$2"
          borderRadius="$full"
          bg="$textCaution"
          pointerEvents="none"
        />
      ) : null}
      {hasNetworksWithoutAccount && !desktopHeader ? (
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

  if (!desktopHeader) {
    return trigger;
  }
  return (
    <Tooltip
      renderContent={tooltipText}
      placement="bottom"
      renderTrigger={trigger}
    />
  );
}

export { AllNetworksManagerTrigger };
