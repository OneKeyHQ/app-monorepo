import { memo, useEffect, useRef } from 'react';

import {
  HeaderScrollGestureWrapper,
  Stack,
  YStack,
} from '@onekeyhq/components';
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

export type IHomeHeaderContainerVariant = 'normal' | 'notBackedUp';

function BaseHomeHeaderContainer({
  variant = 'normal',
}: {
  variant?: IHomeHeaderContainerVariant;
}) {
  const {
    activeAccount: { wallet, account, network, vaultSettings },
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

  const isWalletNotBackedUp = variant === 'notBackedUp';

  // Banner only renders once we have actual banner content AND the balance is
  // confirmed positive. Treating 'unknown' as hidden avoids the show→hide
  // flicker that previously occurred when the page mounted with the banner
  // visible and then collapsed once the first balance fetch came back zero.
  const homeBalanceState = useHomeBalanceState();
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
            <HomeOverviewContainer />
          </Stack>
        ) : (
          <HeaderScrollGestureWrapper onRefresh={onHomePageRefresh}>
            <Stack gap="$2.5">
              <HomeOverviewContainer />
            </Stack>
          </HeaderScrollGestureWrapper>
        )}
        {isWalletNotBackedUp ? null : (
          <HeaderScrollGestureWrapper onRefresh={onHomePageRefresh}>
            <WalletActions />
          </HeaderScrollGestureWrapper>
        )}
      </Stack>
      {/* Keep mounted on the normal variant so initLocalBanners + remote fetch
          effects run. Gating the component on `shouldShowBanner` would create
          a deadlock because WalletBanner owns the effect that populates its
          atom. The not-backed-up variant intentionally skips banner work. */}
      {isWalletNotBackedUp ? null : <WalletBanner hidden={!shouldShowBanner} />}
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
export const HomeHeaderContainer = memo(
  ({ variant = 'normal' }: { variant?: IHomeHeaderContainerVariant }) => (
    <HomeTokenListProviderMirror>
      <BaseHomeHeaderContainer variant={variant} />
    </HomeTokenListProviderMirror>
  ),
);
HomeHeaderContainer.displayName = 'HomeHeaderContainer';
