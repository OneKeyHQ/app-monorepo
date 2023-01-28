import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
  Badge,
  BottomSheetModal,
  Box,
  Button,
  Center,
  Icon,
  IconButton,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';
import { RootRoutes } from '@onekeyhq/kit/src/routes/types';
import type { PublicBackupData } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { showOverlay } from '../../../../../utils/overlayUtils';
import { EOnboardingRoutes } from '../../../routes/enums';
import { parseDeviceInfo } from '../util';

import { ExportResult, useExportData } from './hook';

type Props = {
  serverInfo: DeviceInfo;
  clientInfo: DeviceInfo;
  serverAddress: string;
  closeOverlay: () => void;
};

function isEmptyData(data: PublicBackupData) {
  let empty = true;
  Object.entries(data).forEach(([_, value]) => {
    if (!isEmpty(value)) {
      empty = false;
    }
  });
  return empty;
}
const Content: FC<Props> = ({
  serverAddress,
  clientInfo,
  serverInfo,
  closeOverlay,
}) => {
  const [fromData, updateFromData] = useState(clientInfo);
  const [toData, updateToData] = useState(serverInfo);
  const parseFromData = parseDeviceInfo(fromData);
  const parseToData = parseDeviceInfo(toData);
  const [isSend, setIsSend] = useState(true);
  const intl = useIntl();
  const { serviceMigrate } = backgroundApiProxy;
  const { exportDataRequest } = useExportData();

  const navigation = useNavigation();

  useEffect(() => {
    if (isSend) {
      updateFromData(clientInfo);
      updateToData(serverInfo);
    } else {
      updateFromData(serverInfo);
      updateToData(clientInfo);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSend]);

  const sendAction = useCallback(async () => {
    const { status, data } = await exportDataRequest();
    if (status === ExportResult.SUCCESS) {
      const success = await serviceMigrate.sendDataToServer({
        ipAddress: serverAddress,
        data: JSON.stringify(data),
      });
      return success;
    }
    if (status === ExportResult.EMPTY) {
      ToastManager.show(
        {
          title: intl.formatMessage({
            id: 'msg__no_data_available',
          }),
        },
        { type: 'default' },
      );
    }
    return false;
  }, [exportDataRequest, intl, serverAddress, serviceMigrate]);

  const getDataAction = useCallback(async () => {
    const data = await serviceMigrate.getDataFromServer({
      ipAddress: serverAddress,
    });
    if (data) {
      if (isEmptyData(JSON.parse(data.public))) {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__no_data_available',
            }),
          },
          { type: 'default' },
        );
        return false;
      }
      serviceMigrate.disConnectServer(serverAddress);
      closeOverlay();
      navigation.navigate(RootRoutes.Onboarding, {
        screen: EOnboardingRoutes.MigrationPreview,
        params: { data },
      });
      return true;
    }
    return false;
  }, [closeOverlay, intl, navigation, serverAddress, serviceMigrate]);

  const [isLoading, setLoading] = useState(false);
  const migrateAction = useCallback(async () => {
    setLoading(true);
    if (isSend) {
      const success = await sendAction();
      if (success) {
        ToastManager.show({
          title: `🧙 ${intl.formatMessage(
            {
              id: 'msg__data_sent_to_platform',
            },
            { platform: parseToData.name },
          )}`,
        });
        serviceMigrate.disConnectServer(serverAddress);
        closeOverlay();
      }
    } else {
      await getDataAction();
    }
    setLoading(false);
  }, [
    closeOverlay,
    getDataAction,
    intl,
    isSend,
    parseToData.name,
    sendAction,
    serverAddress,
    serviceMigrate,
  ]);

  return (
    <BottomSheetModal
      title={intl.formatMessage({ id: 'modal__migrating_data' })}
      headerDescription={
        <Text typography="Caption" color="text-success">
          🎉 {intl.formatMessage({ id: 'modal__migrating_data_desc' })}
        </Text>
      }
      closeOverlay={() => {
        serviceMigrate.disConnectServer(serverAddress);
        closeOverlay();
      }}
    >
      <Box
        bgColor="surface-default"
        borderRadius="12px"
        borderColor="border-subdued"
        borderWidth={StyleSheet.hairlineWidth}
      >
        <Box py="16px">
          <Text typography="Body2" color="text-subdued" ml="16px">
            {intl.formatMessage({ id: 'content__from' })}
          </Text>
          <Box paddingX="16px" flexDirection="row" mt="12px">
            <Icon name={parseFromData.logo} size={24} color="icon-subdued" />
            <Text typography="Body1Strong" flex={1} ml="8px">
              {parseFromData.name}
            </Text>
            {isSend && (
              <MotiView
                from={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'timing' }}
              >
                <Badge
                  size="sm"
                  type="info"
                  title={intl.formatMessage({ id: 'content__current' })}
                />
              </MotiView>
            )}
          </Box>
        </Box>
        <Box
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderColor="border-subdued"
        />

        <Box py="16px">
          <Text typography="Body2" color="text-subdued" ml="16px">
            {intl.formatMessage({ id: 'content__to' })}
          </Text>
          <Box
            paddingX="16px"
            flexDirection="row"
            justifyContent="space-between"
            mt="12px"
          >
            <Icon name={parseToData.logo} size={24} color="icon-subdued" />
            <Text typography="Body1Strong" flex={1} ml="8px">
              {parseToData.name}
            </Text>
            {!isSend && (
              <MotiView
                from={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'timing' }}
              >
                <Badge
                  size="sm"
                  type="info"
                  title={intl.formatMessage({ id: 'content__current' })}
                />
              </MotiView>
            )}
          </Box>
        </Box>
        <Center position="absolute" width="full" height="full">
          <IconButton
            onPress={() => {
              setIsSend((prev) => !prev);
            }}
            name="SwitchVerticalOutline"
            circle
            type="basic"
            size="base"
            iconColor="icon-default"
          />
        </Center>
      </Box>
      <Box mt="24px">
        {isLoading && (
          <Alert
            customIconName="CheckCircleMini"
            title={intl.formatMessage(
              {
                id: 'modal__migrating_data_awaiting_confirmation',
              },
              {
                from: parseFromData.name,
              },
            )}
            alertType="success"
            dismiss={false}
          />
        )}
        <Button
          mt="12px"
          size="xl"
          type="primary"
          onPress={migrateAction}
          isLoading={isLoading}
        >
          {intl.formatMessage({ id: 'action__migrate' })}
        </Button>
      </Box>
    </BottomSheetModal>
  );
};

export const showMigrateDataModal = (props: Omit<Props, 'closeOverlay'>) =>
  showOverlay((close) => <Content {...props} closeOverlay={close} />);
