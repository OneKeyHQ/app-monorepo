import type { FC } from 'react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import semver from 'semver';

import {
  Box,
  Button,
  Center,
  Dialog,
  Icon,
  Spinner,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { ICON_NAMES } from '@onekeyhq/components/src/Icon';
import { backupPlatform } from '@onekeyhq/shared/src/cloudfs';
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';
import type {
  ISimpleDBBackUp,
  PublicBackupData,
} from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { useAppSelector, useData } from '../../../../hooks/redux';
import useImportBackupPasswordModal from '../../../../hooks/useImportBackupPasswordModal';
import useLocalAuthenticationModal from '../../../../hooks/useLocalAuthenticationModal';
import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import { showOverlay } from '../../../../utils/overlayUtils';

import BackupIcon from './BackupIcon';
import BackupSummary from './BackupSummary';
import { showUpgrateDialog } from './UpgrateDialog';
import Wrapper from './Wrapper';

import type { HomeRoutes, RootRoutes } from '../../../../routes/routesEnum';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '../../../../routes/types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { IBoxProps } from 'native-base';

type BackupDetailsRouteProp = RouteProp<
  HomeRoutesParams,
  HomeRoutes.CloudBackupDetails
>;

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
>;

const WalletBackupItem = ({
  name,
  avatar,
  accountUUIDs,
}: {
  name: string;
  avatar?: Avatar;
  accountUUIDs: Array<string>;
}) => {
  const intl = useIntl();

  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      py={1}
    >
      <Center
        rounded="full"
        size="8"
        bgColor={avatar?.bgColor ?? 'surface-neutral-default'}
      >
        {avatar?.emoji ? (
          <Text typography="DisplayMedium">{avatar.emoji}</Text>
        ) : undefined}
      </Center>
      <Text px="4" typography="Body2Strong" flex="1" isTruncated>
        {name}
      </Text>
      <Text typography="Body2" color="text-subdued">
        {intl.formatMessage(
          { id: 'form__str_accounts' },
          { count: accountUUIDs.length },
        )}
      </Text>
    </Box>
  );
};

const GenericBackupItem = ({
  iconName,
  name,
  address,
}: {
  iconName: ICON_NAMES;
  name: string;
  address: string;
}) => (
  <Box
    display="flex"
    flexDirection="row"
    justifyContent="space-between"
    alignItems="center"
    py={1}
  >
    <Center rounded="full" size="8" bgColor="surface-neutral-default">
      <Icon name={iconName} size={20} color="icon-default" />
    </Center>
    <Text px="4" typography="Body2Strong" flex="1" isTruncated>
      {name}
    </Text>
    <Text typography="Body2" color="text-subdued">
      {address}
    </Text>
  </Box>
);

export const GroupedBackupDetails = ({
  onDevice,
  showTitle = true,
  publicBackupData,
}: {
  showTitle?: boolean;
  onDevice: boolean;
  publicBackupData: PublicBackupData;
}) => {
  const intl = useIntl();

  const walletsData = Object.entries(publicBackupData.HDWallets)
    .map(([uuid, info]) => ({ uuid, ...info }))
    .sort((a, b) => natsort({ insensitive: true })(a.name, b.name));
  const importedAccountsData = Object.entries(publicBackupData.importedAccounts)
    .map(([uuid, info]) => ({ uuid, ...info }))
    .sort((a, b) => natsort({ insensitive: true })(a.name, b.name));
  const watchingAccountsData = Object.entries(publicBackupData.watchingAccounts)
    .map(([uuid, info]) => ({ uuid, ...info }))
    .sort((a, b) => natsort({ insensitive: true })(a.name, b.name));
  const contactsData = Object.entries(publicBackupData.contacts)
    .map(([uuid, info]) => ({ uuid, ...info }))
    .sort((a, b) => natsort({ insensitive: true })(a.name, b.name));

  const utxos = publicBackupData?.simpleDb?.utxoAccounts?.utxos;

  return (
    <Box my={4} mx={12}>
      {showTitle && (
        <Text typography="Heading" pb="4">
          {intl.formatMessage({
            id: onDevice
              ? 'content__active_on_this_device'
              : 'content__not_on_this_device',
          })}
        </Text>
      )}
      {walletsData.map(({ uuid, name, avatar, accountUUIDs }) => (
        <WalletBackupItem
          name={name}
          avatar={avatar}
          accountUUIDs={accountUUIDs}
          key={uuid}
        />
      ))}
      {importedAccountsData.map(({ uuid, name, address }) => (
        <GenericBackupItem
          iconName="InboxArrowDownOutline"
          name={name}
          address={address}
          key={uuid}
        />
      ))}
      {watchingAccountsData.map(({ uuid, name, address }) => (
        <GenericBackupItem
          iconName="EyeOutline"
          name={name}
          address={address}
          key={uuid}
        />
      ))}
      {contactsData.map(({ uuid, name, address }) => (
        <GenericBackupItem
          iconName="BookOpenOutline"
          name={name}
          address={address}
          key={uuid}
        />
      ))}

      {utxos?.length ? (
        <GenericBackupItem
          iconName="TagOutline"
          name={intl.formatMessage({
            id: 'form__utxo_label',
          })}
          address={intl.formatMessage(
            {
              id: 'content__int_items',
            },
            { 0: utxos?.length },
          )}
        />
      ) : null}
    </Box>
  );
};

const BackupActions = ({
  size,
  ready,
  onImport,
  onDelete,
  ...rest
}: {
  size: 'base' | 'xl';
  ready: boolean;
  onImport?: () => void;
  onDelete?: () => void;
} & IBoxProps) => {
  const intl = useIntl();

  return (
    <Box flexDirection="row" {...rest}>
      {typeof onImport !== 'undefined' && !ready ? (
        <Button
          onPress={onImport}
          type="primary"
          size={size}
          flexGrow={{ base: 1, sm: 0 }}
        >
          {intl.formatMessage({ id: 'action__import' })}
        </Button>
      ) : undefined}
      {typeof onDelete !== 'undefined' && !ready ? (
        <Button
          onPress={onDelete}
          type="destructive"
          size={size}
          ml={4}
          flexGrow={{ base: 1, sm: 0 }}
        >
          {intl.formatMessage({ id: 'action__delete' })}
        </Button>
      ) : undefined}
    </Box>
  );
};

export function checkHasRemoteData(notOnDevice: PublicBackupData): boolean {
  if (notOnDevice?.simpleDb?.utxoAccounts?.utxos.length) {
    return true;
  }
  return (
    Object.entries(notOnDevice).filter(
      ([key, value]) => key !== 'simpleDb' && Object.keys(value).length > 0,
    ).length > 0
  );
}

const BackupDetails: FC<{ onboarding: boolean }> = ({ onboarding = false }) => {
  const intl = useIntl();

  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BackupDetailsRouteProp>();
  const localVersion = useAppSelector((s) => s.settings.version);

  const { isPasswordSet } = useData();
  const { serviceCloudBackup } = backgroundApiProxy;
  const { showVerify } = useLocalAuthenticationModal();
  const { requestBackupPassword } = useImportBackupPasswordModal();
  const onboardingDone = useOnboardingDone();

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'title__backup_details' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  const {
    backupUUID,
    backupTime,
    numOfHDWallets,
    numOfImportedAccounts,
    numOfWatchingAccounts,
    numOfContacts,
  } = route.params;

  const [dataReady, setDataReady] = useState(true);
  const [backupData, setBackupData] = useState<{
    alreadyOnDevice: PublicBackupData;
    notOnDevice: PublicBackupData;
  }>({
    alreadyOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
    },
    notOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
    },
  });
  const [hasLocalData, setHasLocalData] = useState(false);
  const [version, setVersion] = useState<string | undefined>();
  const [hasRemoteData, setHasRemoteData] = useState(false);

  const checkVersion = useCallback(() => {
    // old version
    if (version === undefined) {
      return true;
    }
    // data version >= local version
    if (version && semver.gt(version, localVersion)) {
      return false;
    }
    return true;
  }, [localVersion, version]);

  useEffect(() => {
    serviceCloudBackup
      .getBackupDetails(backupUUID)
      .then(({ backupDetails, appVersion }) => {
        setVersion(appVersion);
        setBackupData(backupDetails);
        setHasLocalData(
          Object.values(backupDetails.alreadyOnDevice).some(
            (o) => Object.keys(o).length > 0,
          ),
        );
        setHasRemoteData(checkHasRemoteData(backupDetails.notOnDevice));
        setDataReady(false);
      });
  }, [setDataReady, serviceCloudBackup, backupUUID]);

  const onImportDone = useCallback(async () => {
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__backup_imported' }),
    });
    if (onboarding) {
      await onboardingDone({ delay: 200 });
    } else {
      navigation.popToTop();
    }
  }, [intl, onboarding, onboardingDone, navigation]);

  const onImportError = useCallback(() => {
    ToastManager.show(
      {
        title: intl.formatMessage({
          id: 'msg__import_icloud_backup_failed_version',
        }),
      },
      { type: 'error' },
    );
    navigation.goBack();
  }, [intl, navigation]);

  const onImport = useCallback(() => {
    if (checkVersion() === false) {
      showUpgrateDialog();
      return;
    }
    if (isPasswordSet) {
      showVerify(
        (localPassword) => {
          serviceCloudBackup
            .restoreFromBackup({
              backupUUID,
              notOnDevice: backupData.notOnDevice,
              localPassword,
            })
            .then((r) => {
              if (r === RestoreResult.SUCCESS) {
                onImportDone();
              } else if (r === RestoreResult.WRONG_PASSWORD) {
                requestBackupPassword(
                  (remotePassword) =>
                    serviceCloudBackup.restoreFromBackup({
                      backupUUID,
                      notOnDevice: backupData.notOnDevice,
                      localPassword,
                      remotePassword,
                    }),
                  onImportDone,
                  onImportError,
                );
              } else {
                onImportError();
              }
            });
        },
        () => {},
      );
    } else {
      requestBackupPassword(
        (remotePassword) =>
          serviceCloudBackup.restoreFromBackup({
            backupUUID,
            notOnDevice: backupData.notOnDevice,
            localPassword: remotePassword,
            remotePassword,
          }),
        onImportDone,
        onImportError,
      );
    }
  }, [
    isPasswordSet,
    checkVersion,
    showVerify,
    serviceCloudBackup,
    backupUUID,
    backupData.notOnDevice,
    onImportDone,
    requestBackupPassword,
    onImportError,
  ]);

  const onDelete = useCallback(() => {
    showOverlay((onClose) => (
      <Dialog
        visible
        onClose={onClose}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          secondaryActionTranslationId: 'action__cancel',
          primaryActionProps: {
            type: 'destructive',
            onPromise: async () => {
              await serviceCloudBackup.removeBackup(backupUUID);
              onClose();
              navigation.pop(2);
            },
          },
        }}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'dialog__delete_backup',
          }),
          content: intl.formatMessage(
            {
              id: 'dialog__delete_backup_desc',
            },
            { 'cloudName': backupPlatform().cloudName },
          ),
        }}
      />
    ));
  }, [backupUUID, intl, navigation, serviceCloudBackup]);

  return (
    <Wrapper
      footer={
        isSmallScreen ? (
          <BackupActions
            ready={dataReady}
            onImport={hasRemoteData ? onImport : undefined}
            onDelete={onboarding ? undefined : onDelete}
            size="xl"
            position="absolute"
            bottom={0}
          />
        ) : undefined
      }
    >
      {/* Header */}
      <Box flexDirection={isSmallScreen ? 'column' : 'row'} alignItems="center">
        <Box mb={{ base: 6, sm: 0 }} mr={{ sm: 6 }}>
          <BackupIcon size="lg" enabled />
        </Box>
        <BackupSummary
          backupTime={backupTime}
          numOfHDWallets={numOfHDWallets}
          numOfImportedAccounts={numOfImportedAccounts}
          numOfWatchingAccounts={numOfWatchingAccounts}
          numOfContacts={numOfContacts}
          size="heading"
        />
        {isSmallScreen ? undefined : (
          <BackupActions
            ready={dataReady}
            onImport={hasRemoteData ? onImport : undefined}
            onDelete={onboarding ? undefined : onDelete}
            size="base"
            ml="auto"
          />
        )}
      </Box>
      {/* Divider */}
      <Box
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="divider"
        mt={{ base: 6, sm: 8 }}
        mb={{ base: 2, sm: 4 }}
      />
      {dataReady ? (
        <Spinner size="lg" />
      ) : (
        <Box flexDirection={isSmallScreen ? 'column' : 'row'} mx={-12}>
          {hasLocalData ? (
            <GroupedBackupDetails
              onDevice
              publicBackupData={backupData.alreadyOnDevice}
            />
          ) : undefined}
          {hasRemoteData ? (
            <GroupedBackupDetails
              onDevice={false}
              publicBackupData={backupData.notOnDevice}
            />
          ) : undefined}
        </Box>
      )}
    </Wrapper>
  );
};

export default BackupDetails;
