import React, { useEffect, useLayoutEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Pressable,
  Spinner,
  Text,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../hooks';
import { useAppSelector } from '../../../../hooks/redux';
import useFormatDate from '../../../../hooks/useFormatDate';
import {
  HomeRoutes,
  HomeRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../../../routes/types';

import BackupIcon from './BackupIcon';

import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = CompositeNavigationProp<
  NativeStackNavigationProp<RootRoutesParams, RootRoutes.Root>,
  NativeStackNavigationProp<
    HomeRoutesParams,
    HomeRoutes.CloudBackupPreviousBackups
  >
>;

const InProgressContent = () => {
  const intl = useIntl();

  return (
    <Box flexDirection="row" alignItems="center" py="4">
      <Center rounded="full" size="12" bgColor="surface-neutral-subdued">
        <Spinner />
      </Center>
      <Box pl="1">
        <Text typography="Body1Strong">
          {intl.formatMessage({ id: 'content__uploading_encrypted_backup' })}
        </Text>
        <Text typography="Body2" color="text-subdued">
          {intl.formatMessage({
            id: 'content__uploading_encrypted_backup_desc',
          })}
        </Text>
      </Box>
    </Box>
  );
};

const EnabledContent = ({
  lastBackup,
  inProgress,
}: {
  lastBackup: number;
  inProgress: boolean;
}) => {
  const intl = useIntl();
  const formatDate = useFormatDate();
  const { serviceCloudBackup } = backgroundApiProxy;

  const [showDisableBackupDialog, setShowDisableBackupDialog] = useState(false);

  return inProgress ? (
    <InProgressContent />
  ) : (
    <Box flexDirection="row" alignItems="center" py="4">
      <BackupIcon enabled />
      <Box pl="1" flex="1">
        <Text typography="Body1Strong">
          {intl.formatMessage({ id: 'content__backup_enabled' })}
        </Text>
        <Text typography="Body2" color="text-subdued">
          {lastBackup > 0
            ? formatDate.format(new Date(lastBackup), 'MMM d, yyyy, HH:mm:ss')
            : ''}
        </Text>
      </Box>
      <IconButton
        type="plain"
        size="lg"
        name="DotsVerticalOutline"
        onPress={() => {
          setShowDisableBackupDialog(true);
        }}
      />
      <Dialog
        visible={showDisableBackupDialog}
        footerButtonProps={{
          primaryActionTranslationId: 'action__stop_backup',
          secondaryActionTranslationId: 'action__dismiss',
          primaryActionProps: { type: 'destructive' },
          onPrimaryActionPress: async () => {
            await serviceCloudBackup.disableService();
            setShowDisableBackupDialog(false);
          },
          onSecondaryActionPress: () => {
            setShowDisableBackupDialog(false);
          },
        }}
        contentProps={{
          icon: <BackupIcon enabled />,
          title: intl.formatMessage({
            id: 'dialog__your_wallets_are_backed_up',
          }),
          content: `${intl.formatMessage({
            id: 'dialog__your_wallets_are_backed_up_desc',
          })}\n\n${intl.formatMessage({
            id: 'dialog__your_wallets_are_backed_up_desc_2',
          })}`,
        }}
      />
    </Box>
  );
};

const DisabledContent = () => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();
  const { serviceCloudBackup } = backgroundApiProxy;

  return (
    <Box flexDirection={isSmallScreen ? 'column' : 'row'}>
      <Box flexDirection="row" alignItems="center" py="4">
        <BackupIcon enabled={false} />
        <Box pl="2" flex="1">
          <Text typography="Body1Strong">
            {intl.formatMessage({ id: 'content__backup_disabled' })}
          </Text>
          <Text typography="Body2" color="text-subdued">
            {intl.formatMessage({ id: 'content__backup_disabled_desc' })}
          </Text>
        </Box>
      </Box>
      <Button
        onPress={() => {
          serviceCloudBackup.enableService();
        }}
      >
        {intl.formatMessage({ id: 'action__backup_to_icloud' })}
      </Button>
    </Box>
  );
};

const PreviousBackupsContent = () => {
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const navigation = useNavigation<NavigationProps>();

  return (
    <>
      <Text typography="Body2" color="text-subdued" py="2">
        {intl.formatMessage({ id: 'content__previous_backups_desc' })}
      </Text>
      <Box
        mt="1"
        borderRadius="12"
        background="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        <Pressable
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          px={2}
          py={4}
          onPress={() => {
            navigation.navigate(HomeRoutes.CloudBackupPreviousBackups);
          }}
        >
          <Icon name="ClockOutline" size={20} />
          <Text typography="Body1Strong" flex="1" numberOfLines={1} px="2">
            {intl.formatMessage({ id: 'content__previous_backups' })}
          </Text>
          <Icon name="ChevronRightSolid" size={20} />
        </Pressable>
      </Box>
    </>
  );
};

const CloudBackup = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { serviceCloudBackup } = backgroundApiProxy;

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'action__backup' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  const {
    isAvailable,
    enabled: backupEnabled,
    inProgress,
    lastBackup = 0,
  } = useAppSelector((s) => s.cloudBackup);
  const [hasPreviousBackups, setHasPreviousBackups] = useState(false);

  useEffect(() => {
    const getStatus = async () => {
      const status = await serviceCloudBackup.getBackupStatus();
      setHasPreviousBackups(status.hasPreviousBackups);
    };
    getStatus();
  }, [serviceCloudBackup]);

  return (
    <Box w="full" h="full" bg="background-default" p="4" maxW={768} mx="auto">
      <Text typography="Heading">iCloud</Text>
      {isAvailable ? (
        <Box>
          {backupEnabled ? (
            <EnabledContent lastBackup={lastBackup} inProgress={inProgress} />
          ) : (
            <DisabledContent />
          )}
          {hasPreviousBackups ? <PreviousBackupsContent /> : undefined}
        </Box>
      ) : (
        <Text typography="Body2" color="text-critical">
          {intl.formatMessage({
            id: 'content__log_in_icloud_to_enable_backup',
          })}
        </Text>
      )}
      <Box w="full" py="4">
        <Divider />
      </Box>
      <Text typography="Body2" color="text-subdued">
        {intl.formatMessage({ id: 'content__wont_backup' })}
      </Text>
    </Box>
  );
};

export default CloudBackup;
