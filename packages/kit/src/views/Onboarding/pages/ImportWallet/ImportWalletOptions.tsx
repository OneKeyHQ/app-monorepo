import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { InteractionManager, Keyboard } from 'react-native';

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
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBackupEntryStatus } from '@onekeyhq/kit/src/views/CloudBackup/components/useBackupEntryStatus';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

type IOptionItem = IPropsWithTestId<{
  title?: string;
  description?: string;
  icon: IIconProps['name'];
  iconColor?: IIconProps['color'];
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
              void InteractionManager.runAfterInteractions(() => {
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
  const [migrateLoading, setMigrateLoading] = useState(false);
  const { serviceV4Migration } = backgroundApiProxy;

  const handleMigrateFromV4 = useCallback(async () => {
    try {
      setMigrateLoading(true);

      const shouldMigrate = await serviceV4Migration.checkShouldMigrateV4();
      if (shouldMigrate) {
        const { shouldBackup } = await serviceV4Migration.prepareMigration();
        if (shouldBackup) {
          Toast.message({ title: 'Show backup Modal......' });
        }
        await serviceV4Migration.startV4MigrationFlow();
        Dialog.show({
          showCancelButton: false,
          onConfirmText: 'OK',
          title: 'Migration Complete',
          description: 'Your V4 data have been migrated successfully.',
        });
      }
    } finally {
      setMigrateLoading(false);
    }
  }, [serviceV4Migration]);

  const handleConnectHardwareWalletPress = async () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
  };

  const handleImportRecoveryPhrasePress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    await closeKeyboard();
    navigation.push(EOnboardingPages.ImportRecoveryPhrase);
  };

  const handleImportKeyTag = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EOnboardingPages.ImportKeyTag);
  };

  const handleImportPrivateKeyPress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    await closeKeyboard();
    navigation.push(EOnboardingPages.ImportPrivateKey);
  };

  const handleImportAddressPress = async () => {
    navigation.push(EOnboardingPages.ImportAddress);
  };

  const handleImportFromCloud = async () => {
    await backupEntryStatus.check();
    navigation.push(EOnboardingPages.ImportCloudBackup);
  };

  const options: IOptionSection[] = [
    {
      data: [
        {
          title: intl.formatMessage({
            id: ETranslations.global_recovery_phrase,
          }),
          icon: 'Document2Outline',
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
                      id: ETranslations.global_acknowledged,
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
      ],
    },
    {
      data: [
        {
          title: intl.formatMessage({ id: ETranslations.global_private_key }),
          icon: 'KeyOutline',
          onPress: handleImportPrivateKeyPress,
          testID: 'import-private-key',
        },
        {
          title: intl.formatMessage({ id: ETranslations.global_address }),
          icon: 'EyeOutline',
          onPress: handleImportAddressPress,
          testID: 'import-address',
        },
      ],
    },
    {
      data: [
        ...(platformEnv.isNative
          ? [
              {
                icon: 'CloudOutline',
                title: intl.formatMessage({
                  id: platformEnv.isNativeAndroid
                    ? ETranslations.settings_google_drive_backup
                    : ETranslations.settings_icloud_backup,
                }),
                onPress: handleImportFromCloud,
              } as IOptionItem,
            ]
          : []),
        {
          title: intl.formatMessage({
            id: ETranslations.onboarding_migrate_from_v4,
          }),
          icon: 'StorageOutline',
          onPress: handleMigrateFromV4,
          testID: 'connect-hardware-wallet',
          isLoading: migrateLoading,
        },
      ],
    },
  ];

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_import_wallet })}
      />
      <Page.Body>
        {options.map(({ sectionTitle, data }, index) => (
          <Stack
            key={sectionTitle || index}
            // {...(index !== 0 && { mt: '$5' })}
            // {...(index === options.length - 1 && { pb: '$5' })}
          >
            {sectionTitle ? (
              <SectionList.SectionHeader title={sectionTitle} />
            ) : null}
            {index !== 0 ? <Divider m="$5" /> : null}
            {data.map(
              ({
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
                  <Stack
                    bg="$bgStrong"
                    p="$2"
                    borderRadius="$2"
                    borderCurve="continuous"
                  >
                    <Icon
                      name={icon}
                      flexShrink={0}
                      {...(iconColor && {
                        color: iconColor,
                      })}
                    />
                  </Stack>
                  <ListItem.Text
                    userSelect="none"
                    flex={1}
                    primary={title}
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
