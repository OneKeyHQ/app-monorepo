import { memo, useCallback, useMemo, useState } from 'react';

import { Stack, YStack, useMedia } from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import ReferralCodeBlock from '../components/NotBakcedUp/ReferralCodeBlock';
import { ReceiveInfo } from '../components/ReceiveInfo';
import { WalletActions } from '../components/WalletActions';
import WalletBanner from '../components/WalletBanner';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function BaseHomeHeaderContainer() {
  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const media = useMedia();

  // Solve the problem of list scroll elements disappearing in the extension by using a hack approach.
  const [showReceiveInfo, setShowReceiveInfo] = useState(true);
  const [showReferralCodeBlock, setShowReferralCodeBlock] = useState(true);

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  const renderWalletInitBlock = useCallback(() => {
    if (isWalletNotBackedUp) {
      return null;
    }

    if (platformEnv.isNative || media.gtMd) {
      return (
        <YStack
          $gtMd={{ flexDirection: 'row' }}
          bg="$bgApp"
          pointerEvents="box-none"
        >
          <ReceiveInfo closable containerProps={{ m: '$5' }} />
          <ReferralCodeBlock closable containerProps={{ m: '$5' }} />
        </YStack>
      );
    }

    return (
      <YStack
        $gtMd={{ flexDirection: 'row' }}
        bg="$bgApp"
        pointerEvents="box-none"
      >
        {showReceiveInfo ? (
          <Stack height={270} m="$5">
            <ReceiveInfo closable setShowReceiveInfo={setShowReceiveInfo} />
          </Stack>
        ) : null}
        {showReferralCodeBlock ? (
          <Stack height={270} m="$5">
            <ReferralCodeBlock
              closable
              setShowReferralCodeBlock={setShowReferralCodeBlock}
            />
          </Stack>
        ) : null}
      </YStack>
    );
  }, [isWalletNotBackedUp, media.gtMd, showReceiveInfo, showReferralCodeBlock]);

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
        pointerEvents="box-none"
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
      {renderWalletInitBlock()}
    </HomeTokenListProviderMirror>
  );
}

export const HomeHeaderContainer = memo(BaseHomeHeaderContainer);
