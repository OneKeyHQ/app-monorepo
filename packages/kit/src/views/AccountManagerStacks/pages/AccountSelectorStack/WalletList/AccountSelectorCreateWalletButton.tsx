import { useCallback } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  IconButton,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

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
    <Stack p="$1" my="$2" alignItems="center">
      <ActionList
        placement="right-start"
        renderTrigger={
          <IconButton icon="PlusSmallOutline" testID="add-wallet" />
        }
        title="Add wallet"
        floatingPanelProps={{
          w: '$64',
        }}
        sections={[
          {
            items: [
              {
                label: 'Connect Hardware Wallet',
                icon: platformEnv.isNative ? 'BluetoothOutline' : 'UsbOutline',
                onPress: handleConnectHardwareWalletPress,
                testID: 'hardware-wallet',
              },
            ],
          },
          {
            items: [
              {
                label: 'Create Recovery Phrase',
                icon: 'PlusCircleOutline',
                onPress: handleCreateWalletPress,
                testID: 'create-wallet',
              },
            ],
          },
          {
            items: [
              {
                label: 'Enter Recovery Phrase',
                icon: 'Document2Outline',
                onPress: handleImportWalletPress,
                testID: 'import-wallet',
              },
              ...(platformEnv.isNative
                ? [
                    {
                      label: 'Import with OneKey Lite',
                      icon: 'OnekeyLiteOutline' as IKeyOfIcons,
                      onPress: () => console.log('clicked'),
                    },
                  ]
                : []),
              {
                label: 'Import with OneKey KeyTag',
                icon: 'OnekeyKeytagOutline',
                onPress: () => console.log('clicked'),
              },
            ],
          },
        ]}
      />
      {media.gtMd ? (
        <SizableText size="$bodySm" color="$textSubdued" mt="$1">
          Add wallet
        </SizableText>
      ) : null}
    </Stack>
  );
}
