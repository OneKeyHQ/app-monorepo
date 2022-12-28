import type { FC } from 'react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

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
import type { Avatar } from '@onekeyhq/shared/src/emojiUtils';
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';
import type { PublicBackupData } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { useData } from '../../../../hooks/redux';
import useImportBackupPasswordModal from '../../../../hooks/useImportBackupPasswordModal';
import useLocalAuthenticationModal from '../../../../hooks/useLocalAuthenticationModal';
import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import { HomeRoutes } from '../../../../routes/types';
import { showOverlay } from '../../../../utils/overlayUtils';

import BackupIcon from './BackupIcon';
import BackupSummary from './BackupSummary';
import Wrapper from './Wrapper';

import type {
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../../../routes/types';
import type { RouteProp } from '@react-navigation/core';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { IBoxProps } from 'native-base';

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
  category,
  name,
  address,
}: {
  category: 'importedAccount' | 'watchingAccount' | 'contact';
  name: string;
  address: string;
}) => {
  let iconName: 'EyeOutline' | 'InboxArrowDownOutline' | 'BookOpenOutline' =
    'EyeOutline';
  if (category === 'contact') {
    iconName = 'BookOpenOutline';
  } else if (category === 'importedAccount') {
    iconName = 'InboxArrowDownOutline';
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
      <Text px="4" typography="Body2Strong" flex="1" isTruncated>
        {name}
      </Text>
      <Text typography="Body2" color="text-subdued">
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
    <Box flex="1" my={4} mx={12}>
      <Text typography="Heading" pb="4">
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
          type="basic"
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

const BackupDetails: FC<{ onboarding: boolean }> = ({ onboarding = false }) => {
  const intl = useIntl();

  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<BackupDetailsRouteProp>();

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
  const [deleting, setDeleting] = useState(false);
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

  const onImportDone = useCallback(async () => {
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__backup_imported' }),
    });
    if (onboarding) {
      await onboardingDone({ delay: 200 });
    } else {
      navigation.navigate(HomeRoutes.InitialTab);
    }
  }, [intl, onboarding, onboardingDone, navigation]);

  const onImportError = useCallback(() => {
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__unknown_error' }),
    });
    navigation.goBack();
  }, [intl, navigation]);

  const onImport = useCallback(() => {
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
    showVerify,
    onImportDone,
    onImportError,
    requestBackupPassword,
    serviceCloudBackup,
    backupUUID,
    backupData,
  ]);

  const onDelete = useCallback(() => {
    showOverlay((onClose) => (
      <Dialog
        visible
        onClose={onClose}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          secondaryActionTranslationId: 'action__cancel',
          primaryActionProps: { type: 'destructive' },
          onPrimaryActionPress: async () => {
            if (!deleting) {
              setDeleting(true);
              await serviceCloudBackup.removeBackup(backupUUID);
              setDeleting(false);
              onClose();
              navigation.pop(2);
            }
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
    ));
  }, [backupUUID, deleting, intl, navigation, serviceCloudBackup]);

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
