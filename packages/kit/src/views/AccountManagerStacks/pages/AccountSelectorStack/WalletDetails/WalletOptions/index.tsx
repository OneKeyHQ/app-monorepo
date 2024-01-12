import { useCallback } from 'react';

import { AnimatePresence } from 'tamagui';

import { Divider, HeightTransition, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WalletRemoveButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRemove';
import { EOnboardingPages } from '@onekeyhq/kit/src/views/Onboarding/router/type';
import { WALLET_TYPE_HW } from '@onekeyhq/kit-bg/src/dbs/local/consts';

import { AboutDevice } from './AboutDevice';
import { Advance } from './Advance';
import { HomeScreen } from './HomeScreen';
import { Verification } from './Verification';
import { WalletOptionItem } from './WalletOptionItem';
import { WalletProfile } from './WalletProfile';

import type { IWalletDetailsProps } from '..';

type IWalletOptionsProps = Partial<IWalletDetailsProps>;

export function WalletOptions({ wallet }: IWalletOptionsProps) {
  const navigation = useAppNavigation();

  const handleBackupPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);

  const [editMode] = useAccountSelectorEditModeAtom();
  return (
    <HeightTransition>
      <AnimatePresence>
        {editMode && (
          <Stack
            animation="quick"
            exitStyle={{
              opacity: 0,
            }}
            enterStyle={{
              opacity: 0,
            }}
          >
            {/* Profile */}
            {wallet ? <WalletProfile wallet={wallet} /> : null}

            {/* Options */}
            {wallet?.type === WALLET_TYPE_HW ? (
              <>
                <Verification />
                <HomeScreen />
                <Advance />
                <AboutDevice />
              </>
            ) : (
              <WalletOptionItem
                icon="Shield2CheckOutline"
                label="Backup"
                onPress={handleBackupPress}
              />
            )}
            <WalletRemoveButton wallet={wallet} />

            <Stack py="$2.5">
              <Divider mt="auto" />
            </Stack>
          </Stack>
        )}
      </AnimatePresence>
    </HeightTransition>
  );
}
