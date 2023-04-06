import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  Empty,
  Icon,
  IconButton,
  Spinner,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { MigrateErrorCode } from '@onekeyhq/engine/src/types/migrate';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { PublicBackupData } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { showDialog, showOverlay } from '../../../../../utils/overlayUtils';
import { EOnboardingRoutes } from '../../../routes/enums';
import { deviceInfo, parseDeviceInfo } from '../util';

import { ExportResult, useExportData } from './hook';

type Props = {
  serverInfo?: DeviceInfo;
  serverAddress: string;
  closeOverlay: () => void;
};

function isEmptyData(data: PublicBackupData) {
  let empty = true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Object.entries(data).forEach(([_, value]) => {
    if (!isEmpty(value)) {
      empty = false;
    }
  });
  return empty;
}

enum ConnectStatus {
  Success = 0,
  Fail = 1,
  Connecting = 2,
}

const clientInfo: DeviceInfo = deviceInfo();
const Content: FC<Props> = ({ serverAddress, serverInfo, closeOverlay }) => {
  const { serviceMigrate } = backgroundApiProxy;

  const serverRef = useRef(serverInfo);
  const [connectStatus, updateConnectStatus] = useState<ConnectStatus>(() => {
    if (serverInfo) {
      return ConnectStatus.Success;
    }
    return ConnectStatus.Connecting;
  });

  const [fromData, updateFromData] = useState(clientInfo);
  const [toData, updateToData] = useState(serverRef.current);
  const parseFromData = useMemo(() => parseDeviceInfo(fromData), [fromData]);
  const parseToData = useMemo(() => {
    if (toData) {
      return parseDeviceInfo(toData);
    }
  }, [toData]);

  const [isSend, setIsSend] = useState(true);
  const intl = useIntl();
  const { exportDataRequest } = useExportData();

  const navigation = useNavigation();

  useEffect(() => {
    if (connectStatus === ConnectStatus.Connecting) {
      setTimeout(() => {
        serviceMigrate.connectServer(serverAddress).then((data) => {
          if (data) {
            if (typeof data === 'string') {
              if (data === 'ERR_NETWORK') {
                if (platformEnv.isNativeIOS) {
                  showDialog(<PermissionDialog type="localNetwork" />);
                }
              }
              updateConnectStatus(ConnectStatus.Fail);
            } else {
              serverRef.current = data;
              updateToData(data);
              updateConnectStatus(ConnectStatus.Success);
            }
          } else {
            updateConnectStatus(ConnectStatus.Fail);
          }
        });
      }, 500);
    }
  }, [connectStatus, serverAddress, serviceMigrate]);

  useEffect(() => {
    if (
      connectStatus !== ConnectStatus.Success ||
      serverRef.current === undefined
    ) {
      return;
    }
    if (isSend) {
      updateFromData(clientInfo);
      updateToData(serverRef.current);
    } else {
      updateFromData(serverRef.current);
      updateToData(clientInfo);
    }
  }, [connectStatus, fromData, isSend, toData]);

  const sendAction = useCallback(async () => {
    const { status, data } = await exportDataRequest();
    if (status === ExportResult.SUCCESS) {
      const success = await serviceMigrate.sendDataToServer({
        ipAddress: serverAddress,
        data: JSON.stringify(data),
      });
      if (success && parseToData) {
        ToastManager.show({
          title: `🧙 ${intl.formatMessage(
            {
              id: 'msg__data_sent_to_platform',
            },
            { platform: parseToData.name },
          )}`,
        });
      } else {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'form__failed',
            }),
          },
          { type: 'error' },
        );
      }
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
  }, [exportDataRequest, intl, parseToData, serverAddress, serviceMigrate]);

  const getDataAction = useCallback(async () => {
    const data = await serviceMigrate.getDataFromServer({
      ipAddress: serverAddress,
    });
    if (data) {
      if (typeof data === 'number') {
        if (data === MigrateErrorCode.ConnectFail) {
          updateConnectStatus(ConnectStatus.Fail);
        }
        return;
      }
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
      await sendAction();
      serviceMigrate.disConnectServer(serverAddress);
      closeOverlay();
    } else {
      await getDataAction();
    }
    setLoading(false);
  }, [
    closeOverlay,
    getDataAction,
    isSend,
    sendAction,
    serverAddress,
    serviceMigrate,
  ]);

  const children = useMemo(() => {
    if (connectStatus === ConnectStatus.Connecting) {
      return (
        <Empty
          title=""
          subTitle={
            <Box>
              <Spinner size="lg" />
              <Text mt="12px" typography="DisplayMedium">
                {intl.formatMessage({ id: 'content__connecting' })}
              </Text>
            </Box>
          }
        />
      );
    }
    if (connectStatus === ConnectStatus.Fail) {
      return (
        <Empty
          emoji="🚫"
          title={intl.formatMessage({ id: 'modal__failed_to_connect' })}
          subTitle={intl.formatMessage({
            id: 'modal__migrating_data_connection_failed_desc',
          })}
        />
      );
    }
    if (
      connectStatus === ConnectStatus.Success &&
      parseToData &&
      parseFromData
    ) {
      return (
        <>
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
                <Icon
                  name={parseFromData.logo}
                  size={24}
                  color="icon-subdued"
                />
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
            {isLoading && !isSend && (
              <Alert
                customIconName="EllipsisHorizontalCircleMini"
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
        </>
      );
    }
  }, [
    connectStatus,
    intl,
    isLoading,
    isSend,
    migrateAction,
    parseFromData,
    parseToData,
  ]);

  return (
    <BottomSheetModal
      title={intl.formatMessage({ id: 'modal__migrating_data' })}
      headerDescription={
        connectStatus === ConnectStatus.Success ? (
          <Text typography="Caption" color="text-success">
            🎉 {intl.formatMessage({ id: 'modal__migrating_data_desc' })}
          </Text>
        ) : null
      }
      closeOverlay={() => {
        serviceMigrate.disConnectServer(serverAddress);
        closeOverlay();
      }}
    >
      {children}
    </BottomSheetModal>
  );
};

export const showMigrateDataModal = (props: Omit<Props, 'closeOverlay'>) =>
  showOverlay((close) => <Content {...props} closeOverlay={close} />);
