import { useMemo } from 'react';

import { Stack, YStack } from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import ReferralCodeBlock from '../components/NotBakcedUp/ReferralCodeBlock';
import { ReceiveInfo } from '../components/ReceiveInfo';
import { WalletActions } from '../components/WalletActions';
import WalletBanner from '../components/WalletBanner';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
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

  return (
    <HomeTokenListProviderMirror>
      <Stack
        testID="Wallet-Tab-Header"
        gap="$5"
        p="$5"
        bg="$bgApp"
        $gtLg={{
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Stack gap="$2.5" flex={1}>
          <HomeOverviewContainer />
        </Stack>
        {isWalletNotBackedUp ? null : (
          <WalletActions
            $gtLg={{
              pt: 0,
            }}
          />
        )}
      </Stack>
      {isWalletNotBackedUp ? null : <WalletBanner />}
      <YStack $gtMd={{ flexDirection: 'row' }} gap="$5" p="$5">
        {isWalletNotBackedUp ? null : <ReceiveInfo closable />}
        {isWalletNotBackedUp ? null : <ReferralCodeBlock closable />}
      </YStack>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
