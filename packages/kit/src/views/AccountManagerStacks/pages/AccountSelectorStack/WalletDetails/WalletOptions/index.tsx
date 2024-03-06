import { useCallback, useMemo } from 'react';

import {
  AnimatePresence,
  Divider,
  HeightTransition,
  Stack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { HiddenWalletAddButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/HiddenWalletAddButton';
import { WalletRemoveButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRemove';
import { EOnboardingPages } from '@onekeyhq/kit/src/views/Onboarding/router/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AboutDevice } from './AboutDevice';
import { Advance } from './Advance';
import { HiddenWalletRememberSwitch } from './HiddenWalletRememberSwitch';
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

  const walletSpecifiedOptions = useMemo(() => {
    if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return <HiddenWalletRememberSwitch wallet={wallet} />;
      }

      return (
        <>
          <Verification />
          <HomeScreen />
          <Advance />
          <AboutDevice />
          <HiddenWalletAddButton wallet={wallet} />
        </>
      );
    }
    return (
      <WalletOptionItem
        icon="Shield2CheckOutline"
        label="Backup"
        onPress={handleBackupPress}
      />
    );
  }, [handleBackupPress, wallet]);

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
            {walletSpecifiedOptions}
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
