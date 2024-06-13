import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
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
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { V4MigrationWarningMessage } from './V4MigrationWarningMessage';

function BackupDialogContent({
  item,
  confirmText,
}: {
  item: IV4MigrationBackupItem;
  confirmText: string;
}) {
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
      maskText =
        'Click to view the recovery phrase, make sure no one is looking your screen';
    }
    if (item.importedAccount) {
      maskText =
        'Click to view the private key, make sure no one is looking your screen';
    }
    return (
      <Stack>
        {networkInfo}
        {confirmButton}
        <Stack
          p="$4"
          borderWidth={1}
          borderColor="$borderSubdued"
          backgroundColor="$bgSubdued"
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
          <SizableText color="$textSubdued">{maskText}</SizableText>
        </Stack>
      </Stack>
    );
  }
  return (
    <Stack>
      {networkInfo}
      {confirmButton}
      <Stack
        p="$4"
        borderWidth={1}
        borderColor="$borderSubdued"
        backgroundColor="$bgSubdued"
      >
        <SizableText color="$text" size="$headingLg">
          {secretText}
        </SizableText>
        <Button
          onPress={() => copyText(secretText)}
          mt="$2"
          size="small"
          variant="tertiary"
        >
          Copy
        </Button>
      </Stack>
    </Stack>
  );
}

function AccountsSectionList() {
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
        confirmText = `I've saved the phrases`;
        description =
          'Write down each phrase in order and store them in a secure location';
      }
      if (item.importedAccount) {
        confirmText = `I've saved the private key`;
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
    [],
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
              <NetworkAvatar networkId={item.network.id} />
            ) : undefined
          }
        >
          {migrationData?.backedUpMark?.[item?.backupId] ? (
            <ListItem.Text align="right" secondary="Backed up" />
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

  useEffect(() => {
    setTimeout(() => {
      setConfirmDisabled(false);
    }, 2000);
  }, []);

  return (
    <Stack>
      <SizableText>
        Ensure you have backed up your recovery phrases and private keys to
        avoid asset loss during data migration.
      </SizableText>

      <Dialog.Footer
        key={confirmDisabled ? 'disabled' : 'enabled'}
        onCancelText="Review again"
        onConfirmText={confirmDisabled ? 'Checking' : 'Confirm'}
        confirmButtonProps={{
          disabled: confirmDisabled,
          loading: confirmDisabled,
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
        title: 'Ensure backup to avoid asset loss',
        renderContent: <ConfirmMigrationContent navigation={navigation} />,
      });
    } finally {
      setMigrateLoading(false);
    }
  }, [navigation]);

  return (
    <Page>
      <Page.Header headerTitle="Secure your wallets" />
      <Page.Body>
        <V4MigrationWarningMessage
          title="IMPORTANT: Back up all of your wallets"
          description="Before you proceed, make sure you've backed up the recovery phrases or private keys for all your wallets."
        />
        <AccountsSectionList />
      </Page.Body>
      <Page.Footer
        confirmButton={
          <Page.ConfirmButton
            loading={migrateLoading}
            onConfirm={handleMigrateFromV4}
          >
            I backed them up
          </Page.ConfirmButton>
        }
      />
    </Page>
  );
}

export default V4MigrationPreview;
