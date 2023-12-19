import { useCallback } from 'react';

import { AnimatePresence } from 'tamagui';

import { Divider, HeightTransition, Stack } from '@onekeyhq/components';

import useAppNavigation from '../../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../../routes/Modal/type';
import { EOnboardingPages } from '../../../../Onboarding/router/type';

import { AboutDevice } from './AboutDevice';
import { Advance } from './Advance';
import { HomeScreen } from './HomeScreen';
import { RemoveWallet } from './RemoveWallet';
import { Verification } from './Verification';
import { WalletOptionItem } from './WalletOptionItem';
import { WalletProfile } from './WalletProfile';

import type { IWalletDetailsProps } from '..';

type IWalletOptionsProps = Partial<IWalletDetailsProps>;

export function WalletOptions({ editMode, wallet }: IWalletOptionsProps) {
  const navigation = useAppNavigation();

  const handleBackupPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);

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
            <WalletProfile wallet={wallet} />

            {/* Options */}
            {wallet?.type === 'hw' ? (
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
            <RemoveWallet wallet={wallet} />

            <Stack py="$2.5">
              <Divider mt="auto" />
            </Stack>
          </Stack>
        )}
      </AnimatePresence>
    </HeightTransition>
  );
}
