import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Alert,
  Button,
  Dialog,
  Icon,
  Page,
  SectionList,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import type { IV4MigrationBackupItem } from '@onekeyhq/kit-bg/src/migrations/v4ToV5Migration/types';
import { useV4migrationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

function BackupDialogContent({
  item,
  confirmText,
}: {
  item: IV4MigrationBackupItem;
  confirmText: string;
}) {
  const intl = useIntl();
  const [migrationData, setMigrationData] = useV4migrationAtom();
  const [isMasked, setIsMasked] = useState(true);
  const { copyText } = useClipboard();
  const [secretText, setSecretText] = useState('');
  const networkInfo = item?.network ? (
    <XStack mb="$4">
      <NetworkAvatar networkId={item.network.id} />
      <SizableText ml="$2" color="$textSubdued">
        {item.network.name}
      </SizableText>
    </XStack>
  ) : null;

  const confirmButton = (
    <Dialog.Footer
      showCancelButton={false}
      onConfirmText={confirmText}
      confirmButtonProps={{
        disabled: isMasked,
      }}
      onConfirm={() => {
        setMigrationData((v) => ({
          ...v,
          backedUpMark: {
            ...v.backedUpMark,
            [item.backupId]: true,
          },
        }));
      }}
    />
  );
  if (isMasked) {
    let maskText =
      'Click to view the content, make sure no one is looking your screen';
    if (item.hdWallet) {
      maskText = intl.formatMessage({
        id: ETranslations.v4_migration_backup_recovery_phrase_reveal_alert,
      });
    }
    if (item.importedAccount) {
      maskText = intl.formatMessage({
        id: ETranslations.v4_migration_backup_private_key_reveal_alert,
      });
    }
    return (
      <Stack>
        <Stack
          p="$5"
          userSelect="none"
          borderRadius="$3"
          borderCurve="continuous"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          backgroundColor="$bgSubdued"
          alignItems="center"
          justifyContent="center"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          focusable
          focusStyle={{
            outlineWidth: 2,
            outlineColor: '$focusRing',
            outlineStyle: 'solid',
            outlineOffset: 2,
          }}
          onPress={async () => {
            if (item?.hdWallet?.id) {
              const r =
                await backgroundApiProxy.serviceV4Migration.revealV4HdMnemonic({
                  hdWalletId: item.hdWallet.id,
                });
              setSecretText(r.mnemonic);
            }
            if (item?.importedAccount?.id) {
              const r =
                await backgroundApiProxy.serviceV4Migration.revealV4ImportedPrivateKey(
                  {
                    accountId: item.importedAccount.id,
                  },
                );
              setSecretText(r.exportedPrivateKey);
            }
            setIsMasked(false);
          }}
        >
          <Icon size="$8" name="EyeOutline" />
          <SizableText pt="$5" color="$textSubdued" textAlign="center">
            {maskText}
          </SizableText>
        </Stack>
        {confirmButton}
      </Stack>
    );
  }
  return (
    <Stack>
      <Stack
        py="$1"
        px="$2.5"
        borderRadius="$3"
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        backgroundColor="$bgSubdued"
      >
        {item?.hdWallet?.id ? (
          <XStack flexWrap="wrap">
            {secretText.split(' ').map((word, index) => (
              <XStack
                minWidth="33.33%"
                alignItems="baseline"
                key={index}
                p="$1.5"
                borderBottomWidth={StyleSheet.hairlineWidth}
                borderBottomColor="$borderSubdued"
              >
                <SizableText
                  size="$bodyMd"
                  color="$textDisabled"
                  minWidth="$4"
                  mr="$1"
                >
                  {index + 1}
                </SizableText>
                <SizableText flex={1} size="$bodyLg">
                  {word}
                </SizableText>
              </XStack>
            ))}
          </XStack>
        ) : null}
        {item?.importedAccount?.id ? (
          <SizableText mt="$2" mx="$1.5" color="$text" size="$bodyLg">
            {secretText}
          </SizableText>
        ) : null}

        <Stack p="$2">
          <Button onPress={() => copyText(secretText)} variant="tertiary">
            {intl.formatMessage({ id: ETranslations.global_copy })}
          </Button>
        </Stack>
      </Stack>
      {confirmButton}
    </Stack>
  );
}

function AccountsSectionList() {
  const intl = useIntl();
  const { serviceV4Migration } = backgroundApiProxy;
  const [migrationData, setMigrationData] = useV4migrationAtom();
  const { result: walletsForBackup = [] } = usePromiseResult(
    () => serviceV4Migration.buildV4WalletsForBackupSectionData(),
    [serviceV4Migration],
  );
  console.log('getV4WalletsForBackup >>>>> walletsForBackup', walletsForBackup);

  const showBackupDialog = useCallback(
    ({ item }: { item: IV4MigrationBackupItem }) => {
      let confirmText = `I've backed up`;
      let description: string | undefined;
      if (item.hdWallet) {
        confirmText = intl.formatMessage({
          id: ETranslations.global_saved_the_phrases,
        });
        description = intl.formatMessage({
          id: ETranslations.onboarding_backup_recovery_phrase_help_text,
        });
      }
      if (item.importedAccount) {
        confirmText = intl.formatMessage({
          id: ETranslations.global_saved_the_private_key,
        });
      }

      Dialog.show({
        showCancelButton: false,
        showConfirmButton: false,
        onConfirmText: confirmText,
        title: item.title,
        description,
        renderContent: (
          <BackupDialogContent item={item} confirmText={confirmText} />
        ),
      });
    },
    [intl],
  );

  return (
    <SectionList
      // ListHeaderComponent={V4MigrationWarningMessage}
      sections={walletsForBackup}
      renderSectionHeader={({ section: { title }, index }) => (
        <SectionList.SectionHeader title={title} />
      )}
      estimatedItemSize="$10"
      stickySectionHeadersEnabled
      renderItem={({ item }: { item: IV4MigrationBackupItem }) => (
        <ListItem
          key={item.backupId}
          title={item.title}
          subtitle={item.subTitle}
          subtitleProps={{
            numberOfLines: 1,
          }}
          onPress={() => {
            console.log('clicked', item);
            showBackupDialog({ item });
          }}
          drillIn
          renderAvatar={
            item?.network?.id ? (
              <NetworkAvatar size="$8" networkId={item.network.id} />
            ) : (
              <Stack w="$8" h="$8" justifyContent="center" alignItems="center">
                <SizableText size="$heading3xl">🦄</SizableText>
              </Stack>
            )
          }
        >
          {migrationData?.backedUpMark?.[item?.backupId] ? (
            <ListItem.Text
              align="right"
              secondary={intl.formatMessage({
                id: ETranslations.global_backed_up,
              })}
              secondaryTextProps={{
                size: '$bodyLg',
              }}
            />
          ) : null}
        </ListItem>
      )}
    />
  );
}

function ConfirmMigrationContent({
  navigation,
}: {
  navigation: IAppNavigation;
}) {
  const [confirmDisabled, setConfirmDisabled] = useState(true);
  const [timer, setTimer] = useState(3);
  const intl = useIntl();
  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer === 1) {
          setConfirmDisabled(false);
          clearInterval(intervalId);
          return prevTimer;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <Stack>
      <SizableText>
        {intl.formatMessage({
          id: ETranslations.v4_migration_backed_up_warning_desc,
        })}
      </SizableText>

      <Dialog.Footer
        key={confirmDisabled ? 'disabled' : 'enabled'}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_review_again,
        })}
        onConfirmText={
          confirmDisabled
            ? `${timer}s`
            : intl.formatMessage({ id: ETranslations.global_confirm })
        }
        confirmButtonProps={{
          disabled: confirmDisabled,
        }}
        onConfirm={() => {
          navigation.push(EOnboardingPages.V4MigrationProcess);
        }}
      />
    </Stack>
  );
}

export function V4MigrationPreview({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const [migrateLoading, setMigrateLoading] = useState(false);
  const { serviceV4Migration } = backgroundApiProxy;

  const handleMigrateFromV4 = useCallback(async () => {
    try {
      setMigrateLoading(true);
      Dialog.show({
        tone: 'warning',
        icon: 'ErrorOutline',
        title: intl.formatMessage({
          id: ETranslations.v4_migration_backed_up_warning,
        }),
        renderContent: <ConfirmMigrationContent navigation={navigation} />,
      });
    } finally {
      setMigrateLoading(false);
    }
  }, [intl, navigation]);

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.v4_migration_backup_title,
        })}
      />
      <Page.Body>
        <Alert
          m="$5"
          mt="$2.5"
          type="warning"
          title={intl.formatMessage({
            id: ETranslations.v4_migration_backup_alert_title,
          })}
          description={intl.formatMessage({
            id: ETranslations.v4_migration_backup_alert_desc,
          })}
        />
        <AccountsSectionList />
      </Page.Body>
      <Page.Footer
        confirmButton={
          <Page.ConfirmButton
            loading={migrateLoading}
            onConfirm={handleMigrateFromV4}
          >
            {intl.formatMessage({
              id: ETranslations.v4_migration_backup_primary_action,
            })}
          </Page.ConfirmButton>
        }
      />
    </Page>
  );
}

export default V4MigrationPreview;
