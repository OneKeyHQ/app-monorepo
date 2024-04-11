import { useCallback } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  IconButton,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { useAccountSelectorRoute } from '../../../router/useAccountSelectorRoute';

export function AccountSelectorCreateWalletButton() {
  const media = useMedia();
  const liteCard = useLiteCard();

  const navigation = useAppNavigation();
  const route = useAccountSelectorRoute();
  // const linkNetwork = route.params?.linkNetwork;
  const isEditableRouteParams = route.params?.editable;

  const handleConnectHardwareWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [navigation]);

  const handleCreateWalletPress = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);

  const handleImportWalletPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportRecoveryPhrase,
    });
  }, [navigation]);

  if (!isEditableRouteParams) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const actionListButton = (
    <ActionList
      placement="right-start"
      renderTrigger={<IconButton icon="PlusSmallOutline" testID="add-wallet" />}
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
              onPress: () => void handleCreateWalletPress(),
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
                    onPress: liteCard.importWallet,
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
  );
  const onboardingButton = (
    <IconButton
      onPress={() => {
        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.GetStarted,
        });
      }}
      icon="PlusSmallOutline"
      testID="add-wallet"
    />
  );
  return (
    <Stack p="$1" my="$2" alignItems="center">
      {/* {actionListButton} */}
      {onboardingButton}
      {media.gtMd ? (
        <SizableText size="$bodySm" color="$textSubdued" mt="$1">
          Add wallet
        </SizableText>
      ) : null}
    </Stack>
  );
}
