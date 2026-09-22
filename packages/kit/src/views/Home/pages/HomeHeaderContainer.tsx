import { memo, useEffect, useRef, useSyncExternalStore } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  HeaderScrollGestureWrapper,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IHomePageViewedState } from '@onekeyhq/shared/src/logger/scopes/account/scenes/wallet';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useHomeBalanceState } from '../../../hooks/useHomeBalanceState';
import { useWalletTopBannersAtom } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { onHomePageRefresh } from '../components/PullToRefresh';
import { WalletActions } from '../components/WalletActions';
import WalletBanner from '../components/WalletBanner';
import { HomeTestIDs } from '../testIDs';

import { HomeOverviewContainer } from './HomeOverviewContainer';

const nativeHeaderHeights = new Map<string, number>();
const nativeHeaderHeightListeners = new Set<() => void>();
const subscribeNativeHeaderHeight = (listener: () => void) => {
  nativeHeaderHeightListeners.add(listener);
  return () => {
    nativeHeaderHeightListeners.delete(listener);
  };
};

// Both the header and scroll content select the same measured layout before
// native onLayout reports the new header height on the following frame.
export function useHomeHeaderLayout() {
  const {
    activeAccount: { wallet, account, network, vaultSettings },
  } = useActiveAccount({ num: 0 });
  const [{ banners }] = useWalletTopBannersAtom();
  const homeBalanceState = useHomeBalanceState();
  const { width, fontScale } = useWindowDimensions();
  const isWalletNotBackedUp =
    !!wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped;
  const shouldShowBanner =
    !isWalletNotBackedUp &&
    homeBalanceState === 'positive' &&
    (banners.length > 0 ||
      !!(vaultSettings?.hasResource && account?.id && network?.id));
  const layoutKey = `${homeBalanceState}:${shouldShowBanner}:${isWalletNotBackedUp}:${width}:${fontScale}`;
  const measuredHeight = useSyncExternalStore(
    subscribeNativeHeaderHeight,
    () => nativeHeaderHeights.get(layoutKey),
    () => undefined,
  );
  return {
    wallet,
    isWalletNotBackedUp,
    homeBalanceState,
    shouldShowBanner,
    layoutKey,
    measuredHeight,
  };
}

function BaseHomeHeaderContainer() {
  const {
    wallet,
    isWalletNotBackedUp,
    homeBalanceState,
    shouldShowBanner,
    layoutKey,
  } = useHomeHeaderLayout();

  // Reserve the taller native header (292pt) only when the banner band will
  // actually render; otherwise collapse to the shorter layout so we don't
  // leave an empty gap below WalletActions.
  let nativeMinHeight: number | undefined;
  if (platformEnv.isNative && !isWalletNotBackedUp) {
    nativeMinHeight = shouldShowBanner ? 292 : 182;
  }

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
      onLayout={
        platformEnv.isNative
          ? (event) => {
              const height = Math.round(event.nativeEvent.layout.height);
              if (height > 0) {
                const changed = nativeHeaderHeights.get(layoutKey) !== height;
                nativeHeaderHeights.delete(layoutKey);
                nativeHeaderHeights.set(layoutKey, height);
                if (nativeHeaderHeights.size > 12) {
                  const oldest = nativeHeaderHeights.keys().next().value;
                  if (oldest) nativeHeaderHeights.delete(oldest);
                }
                if (changed)
                  nativeHeaderHeightListeners.forEach((listener) => listener());
              }
            }
          : undefined
      }
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
        <HeaderScrollGestureWrapper onRefresh={onHomePageRefresh}>
          <Stack gap="$2.5">
            <HomeOverviewContainer />
          </Stack>
        </HeaderScrollGestureWrapper>
        {isWalletNotBackedUp ? null : (
          <HeaderScrollGestureWrapper onRefresh={onHomePageRefresh}>
            <WalletActions />
          </HeaderScrollGestureWrapper>
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

// The provider mirror must wrap the component (not live inside its return):
// `useHomeBalanceState` reads tokenList context atoms, so the hook call in
// `BaseHomeHeaderContainer`'s body has to sit inside the provider.
// Note: on the URL-account page (which reuses HomePageView) the token list is
// written to the separate urlAccountHomeTokenList store, not this mirror's
// homeTokenList store — the hook's owner-stamp guard absorbs the mismatch and
// the holdings override simply stays inactive there (worth-only behavior).
export const HomeHeaderContainer = memo(() => (
  <HomeTokenListProviderMirror>
    <BaseHomeHeaderContainer />
  </HomeTokenListProviderMirror>
));
HomeHeaderContainer.displayName = 'HomeHeaderContainer';
