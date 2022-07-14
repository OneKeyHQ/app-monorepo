import React, {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Dialog,
  Divider,
  Icon,
  ScrollView,
  Spinner,
  Text,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { ValidationFields } from '../../../../components/Protected';
import { useNavigation } from '../../../../hooks';
import { useData } from '../../../../hooks/redux';
import useImportBackupPasswordModal from '../../../../hooks/useImportBackupPasswordModal';
import useLocalAuthenticationModal from '../../../../hooks/useLocalAuthenticationModal';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../../../routes/types';
import { Avatar } from '../../../../utils/emojiUtils';

import BackupIcon from './BackupIcon';
import BackupSummary from './BackupSummary';

import type { PublicBackupData } from '../../../../background/services/ServiceCloudBackup';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type BackupDetailsRouteProp = RouteProp<
  HomeRoutesParams,
  HomeRoutes.CloudBackupDetails
>;

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Root>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.InitialTab>
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
      <Text px="2" typography="Body2Strong" flex="1">
        {name}
      </Text>
      <Text typography="Body2" color="text-subdued" pr="2">
        {intl.formatMessage(
          { id: 'form__str_accounts' },
          { count: accountUUIDs.length },
        )}
      </Text>
    </Box>
  );
};

const GenericBackupItem = ({
  category,
  name,
  address,
}: {
  category: 'importedAccount' | 'watchingAccount' | 'contact';
  name: string;
  address: string;
}) => {
  let iconName: 'EyeOutline' | 'SaveOutline' | 'BookOpenOutline' = 'EyeOutline';
  if (category === 'contact') {
    iconName = 'BookOpenOutline';
  } else if (category === 'importedAccount') {
    iconName = 'SaveOutline';
  }

  return (
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
      <Text px="2" typography="Body2Strong" flex="1">
        {name}
      </Text>
      <Text typography="Body2" color="text-subdued" pr="2">
        {address}
      </Text>
    </Box>
  );
};

const GroupedBackupDetails = ({
  onDevice,
  publicBackupData,
}: {
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

  return (
    <Box flex="1">
      <Text typography="Heading" py="2">
        {intl.formatMessage({
          id: onDevice
            ? 'content__active_on_this_device'
            : 'content__not_on_this_device',
        })}
      </Text>
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
          category="importedAccount"
          name={name}
          address={address}
          key={uuid}
        />
      ))}
      {watchingAccountsData.map(({ uuid, name, address }) => (
        <GenericBackupItem
          category="watchingAccount"
          name={name}
          address={address}
          key={uuid}
        />
      ))}
      {contactsData.map(({ uuid, name, address }) => (
        <GenericBackupItem
          category="contact"
          name={name}
          address={address}
          key={uuid}
        />
      ))}
    </Box>
  );
};

const BackupActions = ({
  size,
  ready,
  importing,
  onImport,
  onDelete,
}: {
  size: 'base' | 'xl';
  ready: boolean;
  importing: boolean;
  onImport?: () => void;
  onDelete: () => void;
}) => {
  const intl = useIntl();

  return (
    <Box flexDirection="row" justifyContent="space-between">
      {typeof onImport !== 'undefined' && !ready ? (
        <Button
          onPress={onImport}
          isLoading={importing}
          flex="1"
          mx={2}
          type="basic"
          size={size}
        >
          {intl.formatMessage({ id: 'action__import' })}
        </Button>
      ) : undefined}
      {typeof onDelete !== 'undefined' && !ready ? (
        <Button
          onPress={onDelete}
          flex="1"
          mx={2}
          type="destructive"
          size={size}
        >
          {intl.formatMessage({ id: 'action__delete' })}
        </Button>
      ) : undefined}
    </Box>
  );
};

const BackupDetails: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BackupDetailsRouteProp>();

  const { isPasswordSet } = useData();
  const { serviceCloudBackup } = backgroundApiProxy;
  const { showVerify } = useLocalAuthenticationModal();
  const { requestBackupPassword } = useImportBackupPasswordModal();

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
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteBackupDialog, setShowDeleteBackupDialog] = useState(false);
  const [backupData, setBackupData] = useState({
    alreadyOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
    },
    notOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
    },
  });
  const [hasLocalData, setHasLocalData] = useState(false);
  const [hasRemoteData, setHasRemoteData] = useState(false);

  useEffect(() => {
    serviceCloudBackup.getBackupDetails(backupUUID).then((backupDetails) => {
      setBackupData(backupDetails);
      setHasLocalData(
        Object.values(backupDetails.alreadyOnDevice).some(
          (o) => Object.keys(o).length > 0,
        ),
      );
      setHasRemoteData(
        Object.values(backupDetails.notOnDevice).some(
          (o) => Object.keys(o).length > 0,
        ),
      );
      setDataReady(false);
    });
  }, [setDataReady, serviceCloudBackup, backupUUID]);

  const onImportDone = useCallback(() => {
    toast.show({
      title: intl.formatMessage({ id: 'msg__backup_imported' }),
    });
    setImporting(false);
    navigation.navigate(HomeRoutes.InitialTab);
  }, [toast, intl, setImporting, navigation]);

  const onImportError = useCallback(
    (e) => {
      debugLogger.cloudBackup.error(e);
      if ((e as { message: string }).message === 'Invalid password') {
        toast.show({
          title: intl.formatMessage({ id: 'msg__wrong_password' }),
        });
      } else {
        toast.show({
          title: intl.formatMessage({ id: 'msg__unknown_error' }),
        });
      }
      setImporting(false);
      navigation.goBack();
    },
    [toast, intl, navigation],
  );

  const onImport = useCallback(() => {
    setImporting(true);
    if (isPasswordSet) {
      showVerify(
        (localPassword) => {
          serviceCloudBackup
            .restoreFromBackup({
              backupUUID,
              notOnDevice: backupData.notOnDevice,
              localPassword,
            })
            .then(onImportDone, (e) => {
              if ((e as { message: string }).message === 'Invalid password') {
                requestBackupPassword(
                  (remotePassword) => {
                    serviceCloudBackup
                      .restoreFromBackup({
                        backupUUID,
                        notOnDevice: backupData.notOnDevice,
                        localPassword,
                        remotePassword,
                      })
                      .then(onImportDone, onImportError);
                  },
                  () => {},
                );
              } else {
                debugLogger.cloudBackup.error(e);
                toast.show({
                  title: intl.formatMessage({ id: 'msg__unknown_error' }),
                });
                setImporting(false);
                navigation.goBack();
              }
            });
        },
        () => {},
        null,
        ValidationFields.Secret,
      );
    } else {
      requestBackupPassword(
        (remotePassword) => {
          serviceCloudBackup
            .restoreFromBackup({
              backupUUID,
              notOnDevice: backupData.notOnDevice,
              localPassword: remotePassword,
              remotePassword,
            })
            .then(onImportDone, onImportError);
        },
        () => {},
      );
    }
  }, [
    intl,
    navigation,
    toast,
    isPasswordSet,
    showVerify,
    onImportDone,
    onImportError,
    requestBackupPassword,
    serviceCloudBackup,
    backupUUID,
    backupData,
  ]);

  const onDelete = useCallback(() => {
    setShowDeleteBackupDialog(true);
  }, []);

  return (
    <Box p="4" h="full">
      <ScrollView flex="1">
        <Box
          flexDirection={isSmallScreen ? 'column' : 'row'}
          alignItems="center"
        >
          <BackupIcon enabled />
          <Box m="1" />
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
              importing={importing}
              onImport={hasRemoteData ? onImport : undefined}
              onDelete={onDelete}
              size="base"
            />
          )}
        </Box>
        <Box w="full" py="4">
          <Divider />
        </Box>
        {dataReady ? (
          <Spinner size="lg" />
        ) : (
          <Box
            flexDirection={isSmallScreen ? 'column' : 'row'}
            justifyContent="space-between"
          >
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
      </ScrollView>
      {isSmallScreen ? (
        <BackupActions
          ready={dataReady}
          importing={importing}
          onImport={hasRemoteData ? onImport : undefined}
          onDelete={onDelete}
          size="xl"
        />
      ) : undefined}
      <Dialog
        visible={showDeleteBackupDialog}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          secondaryActionTranslationId: 'action__cancel',
          primaryActionProps: { type: 'destructive' },
          onPrimaryActionPress: async () => {
            if (!deleting) {
              setDeleting(true);
              await serviceCloudBackup.removeBackup(backupUUID);
              setDeleting(false);
              navigation.navigate(HomeRoutes.InitialTab);
            }
          },
          onSecondaryActionPress: () => {
            setShowDeleteBackupDialog(false);
          },
        }}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'dialog__delete_backup',
          }),
          content: intl.formatMessage({
            id: 'dialog__delete_backup_desc',
          }),
        }}
      />
    </Box>
  );
};

export default BackupDetails;
