import { memo, useMemo } from 'react';

import {
  HeaderScrollGestureWrapper,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useHomeBalanceState } from '../../../hooks/useHomeBalanceState';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { onHomePageRefresh } from '../components/PullToRefresh';
import { WalletActions } from '../components/WalletActions';
import WalletBanner from '../components/WalletBanner';
import { HomeTestIDs } from '../testIDs';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function BaseHomeHeaderContainer() {
  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  // Banner only renders once the balance is confirmed positive. Treating
  // 'unknown' as hidden avoids the show→hide flicker that previously occurred
  // when the page mounted with the banner visible and then collapsed once the
  // first balance fetch came back as zero.
  const homeBalanceState = useHomeBalanceState();
  const shouldShowBanner =
    !isWalletNotBackedUp && homeBalanceState === 'positive';

  return (
    <HomeTokenListProviderMirror>
      <YStack
        pb="$8"
        gap="$5"
        minHeight={
          platformEnv.isNative && !isWalletNotBackedUp ? 312 : undefined
        }
        $gtMd={{ gap: '$8' }}
        bg="$bgApp"
        pointerEvents="box-none"
        onLayout={(e) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { NativeLogger: NL, LogLevel: LL } =
              require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
            const { height } = e.nativeEvent.layout;
            NL.write(
              LL.Info,
              `[LayoutDiag] HeaderContainer: h=${height} rounded=${Math.round(height)} diff=${(height - 312).toFixed(2)}`,
            );
          } catch {
            /* */
          }
        }}
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
