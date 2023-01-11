import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  CustomSkeleton,
  Icon,
  Input,
  Pressable,
  QRCode,
  SegmentedControl,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type {
  DeviceInfo,
  MigrateData,
} from '@onekeyhq/engine/src/types/migrate';
import { MigrateNotificationNames } from '@onekeyhq/kit-bg/src/services/ServiceMigrate';
import type { MigrateNotificationData } from '@onekeyhq/kit-bg/src/services/ServiceMigrate';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import { RootRoutes } from '@onekeyhq/kit/src/routes/types';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { gotoScanQrcode } from '../../../utils/gotoScanQrcode';
import { EOnboardingRoutes } from '../../Onboarding/routes/enums';
import { httpServerEnable } from '../util';

import { ExportResult, useConnectServer, useExportData } from './hook';
import { showSendDataRequestModal } from './SendDataRequestModal';

const QRCodeView: FC = () => {
  const intl = useIntl();
  const { serviceMigrate } = backgroundApiProxy;

  const { exportDataRequest } = useExportData();

  const navigation = useNavigation();
  const [serverAddress, updateServerAddress] = useState('');
  const startHttpServer = useCallback(async () => {
    const serverUrl = await serviceMigrate.startHttpServer();
    if (serverUrl) {
      // console.log('serverUrl = ', serverUrl);
      updateServerAddress(serverUrl);
      return true;
    }
    return false;
  }, [serviceMigrate]);

  useEffect(() => {
    if (serverAddress.length === 0) {
      startHttpServer();
    }
    return () => {
      if (serverAddress.length > 0) {
        serviceMigrate.stopHttpServer();
      }
    };
  }, [serverAddress.length, serviceMigrate, startHttpServer]);

  useEffect(() => {
    const httpServerRequest = (request: MigrateNotificationData) => {
      const { type, data } = request;
      if (type === MigrateNotificationNames.ReceiveDataFromClient) {
        const { postData, requestId } = data;
        try {
          if (typeof postData === 'string') {
            const json = JSON.parse(postData) as MigrateData;
            if (
              typeof json?.public === 'string' &&
              typeof json?.private === 'string'
            ) {
              navigation.navigate(RootRoutes.Onboarding, {
                screen: EOnboardingRoutes.MigrationPreview,
                params: { data: json },
              });
              serviceMigrate.serverRespond({
                requestId,
                respondData: { success: true },
              });
            } else {
              serviceMigrate.serverRespond({
                requestId,
                respondData: {
                  success: false,
                  data: 'can not fount public/private.',
                },
              });
              throw new Error(`can not fount public/private.`);
            }
          } else {
            serviceMigrate.serverRespond({
              requestId,
              respondData: {
                success: false,
                data: 'postData is not string',
              },
            });
            throw new Error(`postData is not string`);
          }
        } catch (error: any) {
          console.error(error);
        }
      } else if (type === MigrateNotificationNames.RequestDataFromClient) {
        const { requestId, url: urlPath } = data;
        const url = new URL(urlPath, 'http://example.com');
        const { searchParams } = url;
        const clientInfo = searchParams.get('deviceInfo');
        if (typeof clientInfo === 'string') {
          const json = JSON.parse(clientInfo) as DeviceInfo;
          showSendDataRequestModal({
            deviceInfo: json,
            confirmPress: async () => {
              const { status, data: exportData } = await exportDataRequest();
              if (status === ExportResult.SUCCESS && data) {
                serviceMigrate.serverRespond({
                  requestId,
                  respondData: { success: true, data: exportData },
                });
                return true;
              }
              if (status === ExportResult.EMPTY) {
                ToastManager.show({
                  title: 'No sendable data',
                });
              }
              return false;
            },
          });
        }
      }
    };
    appEventBus.on(AppEventBusNames.HttpServerRequest, httpServerRequest);
    return () => {
      appEventBus.removeListener(
        AppEventBusNames.HttpServerRequest,
        httpServerRequest,
      );
    };
  }, [exportDataRequest, navigation, serviceMigrate]);

  return (
    <Box alignItems="center" width="100%">
      {serverAddress.length > 0 ? (
        <Box
          borderRadius="15px"
          bgColor="#FFFFFF"
          padding="11px"
          size="192px"
          shadow="depth.4"
        >
          <QRCode
            value={`migrate://${serverAddress}`}
            size={170}
            logo={qrcodeLogo}
            logoSize={32}
            logoMargin={4}
            logoBackgroundColor="white"
          />
        </Box>
      ) : (
        <CustomSkeleton borderRadius="15px" width={192} height={192} />
      )}

      {serverAddress.length > 0 ? (
        <Pressable
          onPress={() => {
            copyToClipboard(serverAddress);
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__copied' }),
            });
          }}
          flexDirection="row"
          mt="16px"
          alignItems="center"
        >
          <Icon name="LinkOutline" size={20} color="icon-subdued" />
          <Text ml="8px" typography="Body1Strong">
            {serverAddress}
          </Text>
        </Pressable>
      ) : (
        <CustomSkeleton width={144} height="12px" mt="22px" />
      )}
    </Box>
  );
};

const EnterLinkView: FC = () => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const { connectServer } = useConnectServer();

  return (
    <Box mt="74px" width="285px" height="100%">
      <Input
        leftIconName="LinkOutline"
        rightIconName="ViewfinderCircleMini"
        w="full"
        type="text"
        h="50px"
        value={value}
        placeholder="Link"
        onChangeText={setValue}
        onPressRightIcon={() => {
          gotoScanQrcode((data) => {
            console.log('data = ', data);
          });
        }}
      />
      <Button
        // isLoading={isLoading}
        type="primary"
        size="xl"
        mt="24px"
        onPromise={async () => {
          await connectServer(value);
        }}
      >
        Connect
      </Button>
    </Box>
  );
};

const SecondaryContent: FC = () => {
  const intl = useIntl();

  const [selectRange, setSelectedRange] = useState(() => {
    if (!httpServerEnable()) {
      return 1;
    }
    return 0;
  });

  return (
    <Box alignItems="center">
      {!platformEnv.isNative && httpServerEnable() ? (
        <Box mb="24px">
          <SegmentedControl
            selectedIndex={selectRange}
            onChange={setSelectedRange}
            values={['QR Code', 'Enter Link']}
            style={{ width: 192, height: 36 }}
          />
        </Box>
      ) : null}

      {selectRange === 0 ? <QRCodeView /> : <EnterLinkView />}
    </Box>
  );
};

export default SecondaryContent;
