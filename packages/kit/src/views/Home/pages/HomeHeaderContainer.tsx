import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Stack, YStack } from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { IMPL_XMR } from '@onekeyhq/shared/src/engine/engineConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IHomePageViewedState } from '@onekeyhq/shared/src/logger/scopes/account/scenes/wallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useHomeBalanceState } from '../../../hooks/useHomeBalanceState';
import { useWalletTopBannersAtom } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeHeaderGesture } from '../components/HomeHeaderGesture';
import { onHomePageRefresh } from '../components/PullToRefresh';
import { WalletActions } from '../components/WalletActions';
import WalletBanner from '../components/WalletBanner';
import { HomeTestIDs } from '../testIDs';

import { HomeOverviewContainer } from './HomeOverviewContainer';

import type { IHomePrivacyActionsPresentation } from '../components/HomePrivacyActions';

export interface IHomeHeaderContainerProps {
  layout: ReturnType<typeof useHomeHeaderLayout>;
}

// Share the rendering decision so the parent can select its height before commit.
export function useHomeHeaderLayout() {
  const {
    activeAccount: {
      wallet,
      account,
      network,
      vaultSettings,
      ready,
      isNetworkNotMatched,
    },
  } = useActiveAccount({
    num: 0,
  });

  // Mirror WalletBanner's own render condition so the placeholder height
  // matches what the banner will actually display. WalletBanner returns null
  // when there's no banner content (no banners and no Tron-resource card);
  // otherwise the banner band is ~110pt and the header settles at 292pt.
  const [{ banners }] = useWalletTopBannersAtom();
  const hasTronCard = Boolean(
    vaultSettings?.hasResource && account?.id && network?.id,
  );
  const hasWalletBannerContent = banners.length > 0 || hasTronCard;

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  // Banner only renders once we have actual banner content AND the balance is
  // confirmed positive. Treating 'unknown' as hidden avoids the show→hide
  // flicker that previously occurred when the page mounted with the banner
  // visible and then collapsed once the first balance fetch came back zero.
  const homeBalanceState = useHomeBalanceState();
  const [privacyActionsPresentation, setPrivacyActionsPresentation] =
    useState<IHomePrivacyActionsPresentation>();
  const handleActionsPresentationChange = useCallback(
    (presentation: IHomePrivacyActionsPresentation) => {
      setPrivacyActionsPresentation((previous) =>
        previous?.ownerKey === presentation.ownerKey &&
        previous.variant === presentation.variant
          ? previous
          : presentation,
      );
    },
    [],
  );
  const isMonero =
    !!network?.id &&
    !network.isAllNetworks &&
    networkUtils.getNetworkImpl({ networkId: network.id }) === IMPL_XMR;
  const actionsOwnerKey = `${network?.id ?? ''}:${account?.id ?? ''}`;
  const privacyActionsVariant =
    ready &&
    !isNetworkNotMatched &&
    privacyActionsPresentation?.ownerKey === actionsOwnerKey
      ? privacyActionsPresentation.variant
      : 'privacy-loading';
  const shouldShowBanner =
    !isWalletNotBackedUp &&
    hasWalletBannerContent &&
    homeBalanceState === 'positive';

  // Reserve the taller native header (292pt) only when the banner band will
  // actually render; otherwise collapse to the shorter layout so we don't
  // leave an empty gap below WalletActions.
  let nativeMinHeight: number | undefined;
  if (platformEnv.isNative && !isWalletNotBackedUp) {
    nativeMinHeight = shouldShowBanner ? 292 : 182;
  }

  let variant = isWalletNotBackedUp
    ? 'backup:plain'
    : `home:${shouldShowBanner ? 'banner' : homeBalanceState}`;
  // Zero-balance Enable and Add Money share the description-and-button layout.
  // Keep that measurement when activation completes instead of resetting the header.
  if (
    !isWalletNotBackedUp &&
    platformEnv.isNative &&
    isMonero &&
    privacyActionsVariant !== 'standard' &&
    !(privacyActionsVariant === 'privacy-enable' && homeBalanceState === 'zero')
  ) {
    variant = `${variant}:${privacyActionsVariant}`;
  }
  const onActionsPresentationChange =
    platformEnv.isNative && isMonero
      ? handleActionsPresentationChange
      : undefined;

  return useMemo(
    () => ({
      wallet,
      isWalletNotBackedUp,
      homeBalanceState,
      shouldShowBanner,
      nativeMinHeight,
      variant,
      onActionsPresentationChange,
    }),
    [
      wallet,
      isWalletNotBackedUp,
      homeBalanceState,
      shouldShowBanner,
      nativeMinHeight,
      variant,
      onActionsPresentationChange,
    ],
  );
}

function BaseHomeHeaderContainer({ layout }: IHomeHeaderContainerProps) {
  const {
    wallet,
    isWalletNotBackedUp,
    homeBalanceState,
    shouldShowBanner,
    nativeMinHeight,
    onActionsPresentationChange,
  } = layout;

  // Funnel denominator for backup / receive completion rates: log once per
  // (walletId, state) tuple seen this session. Skip `unknown` so we don't
  // record the loading window as a real impression.
  const homePageViewedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!wallet?.id) return;
    let state: IHomePageViewedState | undefined;
    if (isWalletNotBackedUp) {
      state = 'notBackedUp';
    } else if (homeBalanceState === 'positive') {
      state = 'fundedWallet';
    } else if (homeBalanceState === 'zero') {
      state = 'emptyWallet';
    }
    if (!state) return;
    const key = `${wallet.id}__${state}`;
    if (homePageViewedKeyRef.current === key) return;
    homePageViewedKeyRef.current = key;
    defaultLogger.account.wallet.homePageViewed({
      state,
      walletType: wallet.type,
    });
  }, [wallet?.id, wallet?.type, isWalletNotBackedUp, homeBalanceState]);

  return (
    <YStack
      pb="$8"
      gap="$5"
      minHeight={nativeMinHeight}
      $gtMd={{ gap: '$8' }}
      bg="$bgApp"
      pointerEvents="box-none"
    >
      <Stack
        testID={HomeTestIDs.headerContainer}
        gap="$5"
        pt="$5"
        $gtMd={{
          pt: '$8',
        }}
        px="$pagePadding"
        bg="$bgApp"
        pointerEvents="box-none"
      >
        <HomeHeaderGesture onRefresh={onHomePageRefresh}>
          <Stack gap="$2.5">
            <HomeOverviewContainer />
          </Stack>
        </HomeHeaderGesture>
        {isWalletNotBackedUp ? null : (
          <HomeHeaderGesture onRefresh={onHomePageRefresh}>
            <WalletActions onPresentationChange={onActionsPresentationChange} />
          </HomeHeaderGesture>
        )}
      </Stack>
      {/* Always mount so initLocalBanners + remote fetch effects run.
          Without this, gating on `shouldShowBanner` (which requires
          banners.length > 0) creates a deadlock — banner data is only
          written to the atom from WalletBanner's own useEffect, so the
          atom would stay empty and the banner would never appear after
          a fresh install + first import. The visual hide on
          zero-balance / not-backed-up still works via the `hidden`
          prop. */}
      <WalletBanner hidden={!shouldShowBanner} />
    </YStack>
  );
}

export const HomeHeaderContainer = memo(BaseHomeHeaderContainer);
HomeHeaderContainer.displayName = 'HomeHeaderContainer';
