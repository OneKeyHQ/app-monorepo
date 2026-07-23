import { memo, useEffect, useRef } from 'react';

import {
  HeaderScrollGestureWrapper,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IHomePageViewedState } from '@onekeyhq/shared/src/logger/scopes/account/scenes/wallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { useHomeBalancePresentation } from '../../../hooks/useHomeBalanceState';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useHomeResource } from '../../../states/jotai/contexts/home';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';
import WalletBanner from '../components/WalletBanner';
import { useHomeRefreshIntents } from '../model/react/useHomeRefreshIntents';
import { readHomeBannerStorePayload } from '../model/sections/banner/homeBannerStoreModel';
import { HomeTestIDs } from '../testIDs';

import { HomeOverviewContainer } from './HomeOverviewContainer';

export type IHomeHeaderContainerVariant = 'normal' | 'notBackedUp';

const HOME_WALLET_ACTION_SKELETON_COUNT = 4;

function HomeWalletActionsSkeleton() {
  return (
    <XStack
      w="100%"
      h={66}
      gap="$2"
      pointerEvents="none"
      testID={HomeTestIDs.walletActionsSkeleton}
      $gtSm={{
        gap: '$3',
        h: '$10',
      }}
    >
      {Array.from({ length: HOME_WALLET_ACTION_SKELETON_COUNT }).map(
        (_, index) => (
          <Stack
            key={index}
            flex={1}
            h={66}
            testID={HomeTestIDs.walletActionsSkeletonItem(index)}
            $gtSm={{
              flex: undefined,
              h: '$10',
              w: 120,
            }}
          >
            <Skeleton
              h={66}
              w="100%"
              borderRadius="$4"
              $gtSm={{
                h: '$10',
                borderRadius: '$full',
              }}
            />
          </Stack>
        ),
      )}
    </XStack>
  );
}

function BaseHomeHeaderContainer({
  variant = 'normal',
}: {
  variant?: IHomeHeaderContainerVariant;
}) {
  const {
    activeAccount: { network, wallet },
  } = useActiveAccount({
    num: 0,
  });

  // Mirror WalletBanner's own render condition so the placeholder height
  // matches what the banner will actually display. WalletBanner returns null
  // when there's no banner content (no banners and no Tron-resource card);
  // otherwise the banner band is ~110pt and the header settles at 292pt.
  const bannerResource = useHomeResource('banner');
  const bannerPayload =
    bannerResource.kind === 'ready'
      ? readHomeBannerStorePayload(bannerResource.data)
      : undefined;
  const hasWalletBannerContent = Boolean(
    bannerPayload &&
    (bannerPayload.banners.length > 0 || bannerPayload.tronResource),
  );

  const isWalletNotBackedUp = variant === 'notBackedUp';
  const { refreshAllSections } = useHomeRefreshIntents();

  // Banner only renders once we have actual banner content AND the balance is
  // confirmed positive. Treating 'unknown' as hidden avoids the show→hide
  // flicker that previously occurred when the page mounted with the banner
  // visible and then collapsed once the first balance fetch came back zero.
  const balancePresentation = useHomeBalancePresentation();
  const homeBalanceState = balancePresentation.balanceState;
  const shouldShowBanner =
    !isWalletNotBackedUp &&
    (balancePresentation.correlated
      ? balancePresentation.correlated.showPositiveBanner
      : hasWalletBannerContent && homeBalanceState === 'positive');

  // Reserve the taller native header (292pt) only when the banner band will
  // actually render; otherwise collapse to the shorter layout so we don't
  // leave an empty gap below WalletActions.
  let nativeMinHeight: number | undefined;
  if (platformEnv.isNative && !isWalletNotBackedUp) {
    nativeMinHeight = shouldShowBanner ? 292 : 182;
  }
  let networkScope: 'allNetworks' | 'singleNetwork' | 'unknown' = 'unknown';
  if (network) {
    networkScope = network.isAllNetworks ? 'allNetworks' : 'singleNetwork';
  }
  let walletActionFamily: 'loading' | 'zero' | 'funded' = 'loading';
  if (homeBalanceState === 'positive') {
    walletActionFamily = 'funded';
  } else if (homeBalanceState === 'zero') {
    walletActionFamily = 'zero';
  }
  const balanceTextLength =
    balancePresentation.correlated.kind === 'ready'
      ? balancePresentation.correlated.balance.amount.length
      : 0;

  const homeHeaderDecisionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const decision = {
      networkScope,
      balancePresentationKind: balancePresentation.correlated.kind,
      balanceTextLength,
      balanceState: homeBalanceState,
      bannerResourceKind: bannerResource.kind,
      bannerPayloadParsed: Boolean(bannerPayload),
      bannerCount: bannerPayload?.banners.length ?? 0,
      hasTronResource: Boolean(bannerPayload?.tronResource),
      hasWalletBannerContent,
      showPositiveBanner: balancePresentation.correlated.showPositiveBanner,
      shouldShowBanner,
      walletActionFamily,
      shouldShowWalletActions:
        !isWalletNotBackedUp && homeBalanceState !== 'unknown',
      isWalletNotBackedUp,
      nativeMinHeight,
    } as const;
    const key = stringUtils.stableStringify(decision);
    if (homeHeaderDecisionKeyRef.current === key) {
      return;
    }
    homeHeaderDecisionKeyRef.current = key;
    defaultLogger.wallet.homeUi.homeHeaderDecision(decision);
  }, [
    balancePresentation.correlated.kind,
    balanceTextLength,
    balancePresentation.correlated.showPositiveBanner,
    bannerPayload,
    bannerResource.kind,
    hasWalletBannerContent,
    homeBalanceState,
    isWalletNotBackedUp,
    nativeMinHeight,
    networkScope,
    shouldShowBanner,
    walletActionFamily,
  ]);

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
        {isWalletNotBackedUp ? (
          <Stack gap="$2.5">
            <HomeOverviewContainer
              balancePresentation={balancePresentation.correlated}
            />
          </Stack>
        ) : (
          <HeaderScrollGestureWrapper onRefresh={refreshAllSections}>
            <Stack gap="$2.5">
              <HomeOverviewContainer
                balancePresentation={balancePresentation.correlated}
              />
            </Stack>
          </HeaderScrollGestureWrapper>
        )}
        {isWalletNotBackedUp ? null : (
          <HeaderScrollGestureWrapper onRefresh={refreshAllSections}>
            {balancePresentation.correlated.kind === 'loading' ? (
              <HomeWalletActionsSkeleton />
            ) : (
              <WalletActions balancePresentation={balancePresentation} />
            )}
          </HeaderScrollGestureWrapper>
        )}
      </Stack>
      {/* Keep the read-only renderer mounted so Store updates do not reset its
          scroll position. The root controller owns all banner source work. */}
      {isWalletNotBackedUp ? null : <WalletBanner hidden={!shouldShowBanner} />}
    </YStack>
  );
}

export const HomeHeaderContainer = memo(
  ({ variant = 'normal' }: { variant?: IHomeHeaderContainerVariant }) => (
    <HomeTokenListProviderMirror>
      <BaseHomeHeaderContainer variant={variant} />
    </HomeTokenListProviderMirror>
  ),
);
HomeHeaderContainer.displayName = 'HomeHeaderContainer';
