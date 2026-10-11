import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

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

import type { LayoutChangeEvent } from 'react-native';

/**
 * Identifies the header layout (OK-63873). The header is measured by the
 * collapsible tab container after layout, so a switch between layouts of
 * different height (funded: actions + banner band; empty: the add-money
 * block) left the tab content one or two frames behind. HomePageView keeps
 * the measured height per variant and hands the container the expected
 * height before paint whenever the variant changes.
 */
export interface IHomeHeaderContainerProps {
  onHeaderVariantChange?: (variant: string) => void;
  /** The measured height of this container (alerts above it excluded). */
  onHeaderLayout?: (variant: string, height: number) => void;
}

function BaseHomeHeaderContainer({
  onHeaderVariantChange,
  onHeaderLayout,
}: IHomeHeaderContainerProps) {
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

  // Layout effect: the parent applies the remembered height for this variant
  // in the same commit, before the frame with the new layout is painted.
  // Without a banner the action row still differs by balance state (actions
  // row, add-money block, loading placeholder), so each keeps its own height.
  // Not backed up: no actions or banner, one layout.
  let headerVariant = 'backup:plain';
  if (!isWalletNotBackedUp) {
    headerVariant = `home:${shouldShowBanner ? 'banner' : homeBalanceState}`;
  }
  useLayoutEffect(() => {
    onHeaderVariantChange?.(headerVariant);
  }, [headerVariant, onHeaderVariantChange]);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onHeaderLayout?.(headerVariant, event.nativeEvent.layout.height);
    },
    [headerVariant, onHeaderLayout],
  );

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
      onLayout={onHeaderLayout ? handleLayout : undefined}
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
export const HomeHeaderContainer = memo((props: IHomeHeaderContainerProps) => (
  <HomeTokenListProviderMirror>
    <BaseHomeHeaderContainer {...props} />
  </HomeTokenListProviderMirror>
));
HomeHeaderContainer.displayName = 'HomeHeaderContainer';
