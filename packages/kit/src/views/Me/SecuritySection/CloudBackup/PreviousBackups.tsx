import React, { FC, useEffect, useLayoutEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Spinner,
  Text,
  useTheme,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../../../routes/types';

import BackupSummary from './BackupSummary';

import type { IBackupItemSummary } from '../../../../background/services/ServiceCloudBackup';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Root>,
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.CloudBackupDetails>
>;

const PressableBackupSummary: FC<Omit<IBackupItemSummary, 'deviceInfo'>> = ({
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
    Array<Array<IBackupItemSummary>>
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
    <Box justifyContent="space-between" p={4}>
      {previousBackups.map((group) => (
        <Box>
          <Text typography="Body1" color="text-subdued">
            {group[0].deviceInfo.deviceName}
          </Text>
          <Box
            my={2}
            borderRadius="12"
            bg="surface-default"
            borderWidth={themeVariant === 'light' ? 1 : undefined}
            borderColor="border-subdued"
          >
            {group.map((item) => (
              <PressableBackupSummary key={item.backupUUID} {...item} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default CloudBackup;
