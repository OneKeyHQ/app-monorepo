import { useCallback } from 'react';

import {
  ActionList,
  IconButton,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EOnboardingPages } from '@onekeyhq/kit/src/views/Onboarding/router/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function AccountSelectorCreateWalletButton() {
  const media = useMedia();

  const navigation = useAppNavigation();

  const handleConnectHardwareWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [navigation]);

  const handleCreateWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);

  const handleImportWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportRecoveryPhrase,
    });
  }, [navigation]);

  return (
    <Stack p="$1" alignItems="center" mt="$3">
      <ActionList
        placement="right-start"
        renderTrigger={
          <IconButton
            testID="AccountSelectorCreateWalletButton"
            icon="PlusSmallOutline"
          />
        }
        title="Add wallet"
        items={[
          {
            label: 'Connect Hardware Wallet',
            icon: platformEnv.isNative ? 'BluetoothOutline' : 'UsbOutline',
            onPress: handleConnectHardwareWalletPress,
          },
          {
            label: 'Create Recovery Phrase',
            icon: 'PlusCircleOutline',
            onPress: handleCreateWalletPress,
          },
          {
            label: 'Import Recovery Phrase',
            icon: 'ArrowBottomCircleOutline',
            onPress: handleImportWalletPress,
          },
        ]}
      />
      {media.gtMd && (
        <SizableText size="$bodySm" color="$textSubdued" mt="$1">
          Add wallet
        </SizableText>
      )}
    </Stack>
  );
}
