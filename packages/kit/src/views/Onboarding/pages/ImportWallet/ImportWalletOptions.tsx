import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import type { IIconProps, IPropsWithTestId } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Icon,
  KEYBOARD_HIDE_EVENT_NAME,
  Page,
  SectionList,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useBackupEntryStatus } from '@onekeyhq/kit/src/views/CloudBackup/components/useBackupEntryStatus';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useV4MigrationActions } from '../V4Migration/hooks/useV4MigrationActions';

type IOptionItem = IPropsWithTestId<{
  title?: string;
  description?: string;
  icon: IIconProps['name'];
  iconColor?: IIconProps['color'];
  badge?: React.ReactNode;
  onPress?: IListItemProps['onPress'];
  isLoading?: boolean;
  comingSoon?: boolean;
}>;

type IOptionSection = {
  sectionTitle?: string;
  data: IOptionItem[];
};

// fix android keyboard event in next page.
const closeKeyboard = platformEnv.isNative
  ? () =>
      Promise.race([
        new Promise<void>((resolve) => {
          if (!Keyboard.isVisible()) {
            resolve();
            return;
          }
          const subscription = Keyboard.addListener(
            KEYBOARD_HIDE_EVENT_NAME,
            () => {
              void timerUtils.setTimeoutPromised(() => {
                subscription.remove();
                resolve();
              });
            },
          );
          Keyboard.dismiss();
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ])
  : () => Promise.resolve();

export function ImportWalletOptions() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const liteCard = useLiteCard();
  const backupEntryStatus = useBackupEntryStatus();

  const { result: isV4DbExist = false } = usePromiseResult(
    () => backgroundApiProxy.serviceV4Migration.checkIfV4DbExist(),
    [],
  );

  const v4MigrationActions = useV4MigrationActions();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const handleConnectHardwareWalletPress = async () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
  };

  const handleImportRecoveryPhrasePress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    await closeKeyboard();
    navigation.push(EOnboardingPages.ImportRecoveryPhrase);
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: {
        importType: 'recoveryPhrase',
      },
      isSoftwareWalletOnlyUser,
    });
  };

  const handleImportKeyTag = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EOnboardingPages.ImportKeyTag);
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: {
        importType: 'keyTag',
      },
      isSoftwareWalletOnlyUser,
    });
  };

  const handleImportPrivateKeyPress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    await closeKeyboard();
    navigation.push(EOnboardingPages.ImportPrivateKey);
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: {
        importType: 'privateKey',
      },
      isSoftwareWalletOnlyUser,
    });
  };

  const handleImportAddressPress = async () => {
    navigation.push(EOnboardingPages.ImportAddress);
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: {
        importType: 'address',
      },
      isSoftwareWalletOnlyUser,
    });
  };

  const handleImportFromCloud = async () => {
    await backupEntryStatus.check();
    navigation.push(EOnboardingPages.ImportCloudBackup);
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: {
        importType: 'cloud',
      },
      isSoftwareWalletOnlyUser,
    });
  };

  const handleImportByTransfer = async () => {
    // await backupEntryStatus.check();
    navigation?.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeTransfer,
    });
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: {
        importType: 'transfer',
      },
      isSoftwareWalletOnlyUser,
    });
  };

  const options: IOptionSection[] = [
    {
      sectionTitle: intl.formatMessage({
        id: ETranslations.global_restore,
      }),
      data: [
        {
          icon: 'MultipleDevicesOutline',
          title: intl.formatMessage({
            id: ETranslations.transfer_transfer,
          }),
          description: intl.formatMessage({
            id: ETranslations.prime_transfer_description,
          }),
          onPress: handleImportByTransfer,
        },
        {
          title: intl.formatMessage({
            id: ETranslations.global_recovery_phrase,
          }),
          icon: 'SecretPhraseOutline',
          onPress: () => {
            const dialog = Dialog.show({
              tone: 'warning',
              icon: 'ErrorOutline',
              title: intl.formatMessage({
                id: ETranslations.onboarding_import_recovery_phrase_warning,
              }),
              description: intl.formatMessage({
                id: ETranslations.onboarding_import_recovery_phrase_warning_help_text,
              }),
              renderContent: (
                <Stack>
                  <Button
                    variant="secondary"
                    onPress={async () => {
                      await dialog.close();
                      await handleImportRecoveryPhrasePress();
                    }}
                    testID="acknowledged"
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_ok,
                    })}
                  </Button>
                  <Button
                    variant="tertiary"
                    m="0"
                    mt="$2.5"
                    onPress={async () => {
                      await dialog.close();
                      await handleConnectHardwareWalletPress();
                    }}
                    testID="hardware-wallet"
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_connect_hardware_wallet,
                    })}
                  </Button>
                </Stack>
              ),
              showFooter: false,
            });
          },
          testID: 'import-recovery-phrase',
        },
        ...(platformEnv.isNative
          ? [
              {
                title: intl.formatMessage({
                  id: ETranslations.global_onekey_lite,
                }),
                icon: 'OnekeyLiteOutline',
                onPress: liteCard.importWallet,
              } as IOptionItem,
            ]
          : []),
        {
          icon: 'OnekeyKeytagOutline',
          title: 'OneKey KeyTag',
          onPress: handleImportKeyTag,
        },
        platformEnv.isNative
          ? ({
              icon: 'CloudOutline',
              title: intl.formatMessage({
                id: platformEnv.isNativeAndroid
                  ? ETranslations.global_google_drive
                  : ETranslations.global_icloud,
              }),
              onPress: handleImportFromCloud,
            } as IOptionItem)
          : null,
        isV4DbExist
          ? {
              title: intl.formatMessage({
                id: ETranslations.onboarding_migrate_from_v4,
              }),
              icon: 'StorageOutline',
              onPress: async () => {
                navigation.popStack();
                await timerUtils.wait(100);
                await v4MigrationActions.navigateToV4MigrationPage();
              },
              testID: 'migrate-from-v4',
            }
          : null,
      ].filter(Boolean),
    },
    {
      sectionTitle: intl.formatMessage({ id: ETranslations.global_import }),
      data: [
        {
          title: intl.formatMessage({ id: ETranslations.global_private_key }),
          icon: 'Key2Outline',
          onPress: handleImportPrivateKeyPress,
          testID: 'import-private-key',
        },
      ],
    },
    {
      sectionTitle: intl.formatMessage({
        id: ETranslations.global_watch_only,
      }),
      data: [
        {
          title: intl.formatMessage({
            id: ETranslations.global_address,
          }),
          icon: 'EyeOutline',
          onPress: handleImportAddressPress,
          testID: 'import-address',
        },
      ],
    },
  ];

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.onboarding_choose_import_method,
        })}
      />
      <Page.Body>
        {options.map(({ sectionTitle, data }, index) => (
          <Stack key={sectionTitle || index}>
            {index !== 0 ? <Divider m="$5" /> : null}
            {sectionTitle ? (
              <SectionList.SectionHeader title={sectionTitle} />
            ) : null}
            {data.map(
              ({
                badge,
                title,
                icon,
                description,
                iconColor,
                onPress,
                testID,
                isLoading,
                comingSoon,
              }) => (
                <ListItem
                  key={title}
                  onPress={onPress}
                  drillIn
                  disabled={comingSoon}
                  isLoading={isLoading}
                  testID={testID}
                >
                  <Icon
                    color="$iconSubdued"
                    name={icon}
                    flexShrink={0}
                    {...(iconColor && {
                      color: iconColor,
                    })}
                  />
                  <ListItem.Text
                    userSelect="none"
                    flex={1}
                    primary={
                      <Stack flexDirection="row" alignItems="center" gap="$1.5">
                        <SizableText size="$bodyLgMedium">{title}</SizableText>
                        {badge}
                      </Stack>
                    }
                    secondary={description}
                  />
                  {comingSoon ? (
                    <SizableText color="$textSubdued">Coming soon</SizableText>
                  ) : null}
                </ListItem>
              ),
            )}
          </Stack>
        ))}
      </Page.Body>
    </Page>
  );
}

export default ImportWalletOptions;
