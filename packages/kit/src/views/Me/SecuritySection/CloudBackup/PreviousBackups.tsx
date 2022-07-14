import React, { FC, useEffect, useLayoutEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Spinner, useTheme } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../../../routes/types';

import BackupSummary from './BackupSummary';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Root>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.CloudBackupDetails>
>;

type BackupItemSummaryProps = {
  backupUUID: string;
  backupTime: number;
  numOfHDWallets: number;
  numOfImportedAccounts: number;
  numOfWatchingAccounts: number;
  numOfContacts: number;
};

const PressableBackupSummary: FC<BackupItemSummaryProps> = ({
  backupUUID,
  backupTime,
  numOfHDWallets,
  numOfImportedAccounts,
  numOfWatchingAccounts,
  numOfContacts,
}) => {
  const navigation = useNavigation<NavigationProps>();

  return (
    <Pressable
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      py={2}
      px={4}
      borderBottomWidth="1"
      borderBottomColor="divider"
      onPress={() => {
        navigation.navigate(HomeRoutes.CloudBackupDetails, {
          backupUUID,
          backupTime,
          numOfHDWallets,
          numOfImportedAccounts,
          numOfWatchingAccounts,
          numOfContacts,
        });
      }}
    >
      <BackupSummary
        backupTime={backupTime}
        numOfHDWallets={numOfHDWallets}
        numOfImportedAccounts={numOfImportedAccounts}
        numOfWatchingAccounts={numOfWatchingAccounts}
        numOfContacts={numOfContacts}
        size="normal"
      />
      <Box>
        <Icon name="ChevronRightSolid" size={20} />
      </Box>
    </Pressable>
  );
};

const CloudBackup = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { themeVariant } = useTheme();
  const { serviceCloudBackup } = backgroundApiProxy;

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'content__previous_backups' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  const [loading, setLoading] = useState(true);
  const [previousBackups, setPreviousBackups] = useState<
    Array<BackupItemSummaryProps>
  >([]);

  useEffect(() => {
    const getPreviousBackups = async () => {
      setPreviousBackups(await serviceCloudBackup.getPreviousBackups());
      setLoading(false);
    };
    getPreviousBackups();
  }, [serviceCloudBackup]);

  return loading ? (
    <Spinner size="lg" />
  ) : (
    <Box
      m={4}
      borderRadius="12"
      bg="surface-default"
      borderWidth={themeVariant === 'light' ? 1 : undefined}
      borderColor="border-subdued"
    >
      {previousBackups.map((item) => (
        <PressableBackupSummary key={item.backupUUID} {...item} />
      ))}
    </Box>
  );
};

export default CloudBackup;
