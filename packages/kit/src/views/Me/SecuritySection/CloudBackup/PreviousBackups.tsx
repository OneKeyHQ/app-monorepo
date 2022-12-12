import React, { FC, useEffect, useLayoutEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  Icon,
  Pressable,
  Spinner,
  Text,
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
import Wrapper from './Wrapper';

import type { IBackupItemSummary } from '../../../../background/services/ServiceCloudBackup.types';
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
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      p={2}
      mt={2}
      rounded="xl"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
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
        <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
      </Box>
    </Pressable>
  );
};

const CloudBackup = () => {
  const intl = useIntl();
  const navigation = useNavigation();
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

  return (
    <Wrapper>
      {loading ? (
        <Center py={16}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <>
          {previousBackups.map((group, index) => (
            <Box key={index}>
              {index !== 0 ? (
                <Box
                  borderBottomWidth={StyleSheet.hairlineWidth}
                  borderBottomColor="divider"
                  my={6}
                  bgColor="divider"
                />
              ) : null}
              <Box flexDirection="row">
                <Icon
                  name={
                    group[0].deviceInfo.osName === 'iPadOS'
                      ? 'DeviceTabletOutline'
                      : 'DeviceMobileOutline'
                  }
                  size={20}
                />
                <Text typography="Body2Strong" color="text-subdued" ml={2}>
                  {group[0].deviceInfo.deviceName}
                </Text>
              </Box>
              <Box mx={-2}>
                {group.map((item) => (
                  <PressableBackupSummary key={item.backupUUID} {...item} />
                ))}
              </Box>
            </Box>
          ))}
        </>
      )}
    </Wrapper>
  );
};

export default CloudBackup;
