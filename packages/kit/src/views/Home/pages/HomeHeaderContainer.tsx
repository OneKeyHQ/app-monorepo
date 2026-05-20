import { memo, useMemo } from 'react';

import {
  HeaderScrollGestureWrapper,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
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

function BaseHomeHeaderContainer() {
  const {
    activeAccount: { wallet, account, network, vaultSettings },
  } = useActiveAccount({
    num: 0,
  });

  // Mirror WalletBanner's own render condition so the placeholder height
  // matches what the banner will actually display. WalletBanner returns null
  // when there's no banner content (no banners and no Tron-resource card);
  // otherwise the banner band is ~130pt and the header settles at 312pt.
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

  // Reserve the taller native header (312pt) only when the banner band will
  // actually render; otherwise collapse to the shorter layout so we don't
  // leave an empty gap below WalletActions.
  let nativeMinHeight: number | undefined;
  if (platformEnv.isNative && !isWalletNotBackedUp) {
    nativeMinHeight = shouldShowBanner ? 312 : 182;
  }

  return (
    <HomeTokenListProviderMirror>
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
        {shouldShowBanner ? <WalletBanner /> : null}
      </YStack>
    </HomeTokenListProviderMirror>
  );
}

export const HomeHeaderContainer = memo(BaseHomeHeaderContainer);
