import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { ActionsGroup } from './ActionsGroup';

export function Actions() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const handleCreateWalletPress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EOnboardingPages.BeforeShowRecoveryPhrase);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'createWallet' });
  };

  const handleImportWalletPress = async () => {
    navigation.push(EOnboardingPages.ImportWalletOptions);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'importWallet' });
  };

  const handleConnectHardwareWallet = async () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'connectHWWallet' });
  };

  const handleConnectWalletPress = async () => {
    navigation.push(EOnboardingPages.ConnectWalletSelectNetworks);
    defaultLogger.account.wallet.onboard({
      onboardMethod: 'connect3rdPartyWallet',
    });
  };

  const handleTrackAnyAddressPress = async () => {
    navigation.push(EOnboardingPages.ImportAddress);
  };

  const isDappMode = platformEnv.isWebDappMode;

  return (
    <Stack
      py="$6"
      px="$5"
      gap="$2.5"
      $gtMd={{
        maxWidth: '$96',
      }}
      alignSelf="center"
      w="100%"
    >
      <ActionsGroup
        items={[
          {
            iconName: platformEnv.isNative ? 'BluetoothOutline' : 'UsbOutline',
            label: intl.formatMessage({
              id: ETranslations.global_connect_hardware_wallet,
            }),
            primary: true,
            onPress: handleConnectHardwareWallet,
            testID: 'hardware-wallet',
          },
        ]}
      />

      {!isDappMode ? (
        <ActionsGroup
          items={[
            {
              iconName: 'PlusCircleOutline',
              label: intl.formatMessage({
                id: ETranslations.global_create_wallet,
              }),
              onPress: handleCreateWalletPress,
              testID: 'create-wallet',
            },
            {
              iconName: 'ArrowBottomCircleOutline',
              label: intl.formatMessage({
                id: ETranslations.global_import_wallet,
              }),
              onPress: handleImportWalletPress,
              testID: 'import-wallet',
            },
          ]}
        />
      ) : null}
      {isDappMode ? (
        <ActionsGroup
          items={[
            {
              iconName: 'Link2Outline',
              label: intl.formatMessage({
                id: ETranslations.global_connect_wallet,
              }),
              onPress: handleConnectWalletPress,
              testID: '3rd-party-wallet',
            },
            {
              iconName: 'EyeOutline',
              label: intl.formatMessage({
                id: ETranslations.global_track_any_address,
              }),
              onPress: handleTrackAnyAddressPress,
              testID: 'track-any-address',
            },
          ]}
        />
      ) : (
        <ActionsGroup
          items={[
            {
              iconName: 'Link2Outline',
              label: intl.formatMessage({
                id: ETranslations.global_connect_wallet,
              }),
              onPress: handleConnectWalletPress,
              testID: '3rd-party-wallet',
            },
          ]}
        />
      )}
    </Stack>
  );
}
