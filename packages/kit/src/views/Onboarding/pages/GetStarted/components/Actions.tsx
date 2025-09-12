import { useIntl } from 'react-intl';

import type {
  IActionListItemProps,
  IActionListSection,
} from '@onekeyhq/components';
import { ActionList, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { Action } from './Action';

export function Actions({ showTransfer }: { showTransfer: boolean }) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const handleCreateWalletPress = () => {
    void backgroundApiProxy.servicePassword.promptPasswordVerify().then(() => {
      navigation.push(EOnboardingPages.BeforeShowRecoveryPhrase);
      defaultLogger.account.wallet.onboard({ onboardMethod: 'createWallet' });
    });
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

  const items: IActionListItemProps[] = [
    {
      icon: 'Link2Outline',
      label: intl.formatMessage({
        id: ETranslations.global_connect_wallet,
      }),
      onPress: handleConnectWalletPress,
      testID: '3rd-party-wallet',
    },
    {
      icon: 'EyeOutline',
      label: intl.formatMessage({
        id: ETranslations.global_track_any_address,
      }),
      onPress: handleTrackAnyAddressPress,
      testID: 'track-any-address',
    },
  ];

  const sections: IActionListSection[] = [
    {
      items: [
        {
          icon: 'PlusCircleOutline',
          label: intl.formatMessage({
            id: ETranslations.onboarding_create_new_wallet,
          }),
          description: intl.formatMessage({
            id: ETranslations.global_recovery_phrase,
          }),
          onPress: handleCreateWalletPress,
          testID: 'create-wallet',
        },
        {
          icon: 'ArrowBottomCircleOutline',
          label: intl.formatMessage({
            id: ETranslations.global_import_wallet,
          }),
          description: intl.formatMessage({
            id: ETranslations.onboarding_import_wallet_desc,
          }),
          onPress: handleImportWalletPress,
          testID: 'import-wallet',
        },
      ],
    },
    {
      items: [
        {
          icon: 'Link2Outline',
          label: intl.formatMessage({
            id: ETranslations.onboarding_connect_external_wallet,
          }),
          onPress: handleConnectWalletPress,
          testID: '3rd-party-wallet',
        },
      ],
    },
  ];

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
      <Action
        iconName="UsbOutline"
        label={intl.formatMessage({
          id: ETranslations.global_connect_hardware_wallet,
        })}
        primary
        onPress={handleConnectHardwareWallet}
        testID="hardware-wallet"
      />

      <ActionList
        placement="top"
        floatingPanelProps={{
          width: 344,
        }}
        title={intl.formatMessage({
          id: ETranslations.onboarding_create_or_import_wallet,
        })}
        renderTrigger={
          <Action
            label={intl.formatMessage({
              id: ETranslations.onboarding_create_or_import_wallet,
            })}
            testID="onboarding-create-or-import-wallet"
          />
        }
        {...(platformEnv.isWebDappMode ? { items } : { sections })}
      />

      {showTransfer ? (
        <Action
          iconName="MultipleDevicesOutline"
          label={intl.formatMessage({
            id: ETranslations.transfer_transfer,
          })}
          onPress={() => {
            navigation.pushModal(EModalRoutes.PrimeModal, {
              screen: EPrimePages.PrimeTransfer,
            });
          }}
          testID="transfer"
        />
      ) : null}
    </Stack>
  );
}
