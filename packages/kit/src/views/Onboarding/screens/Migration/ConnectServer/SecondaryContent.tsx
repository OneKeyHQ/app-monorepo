import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  Center,
  CustomSkeleton,
  Icon,
  IconButton,
  Input,
  Pressable,
  QRCode,
  SegmentedControl,
  Skeleton,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type {
  DeviceInfo,
  MigrateData,
} from '@onekeyhq/engine/src/types/migrate';
import { httpServerEnable } from '@onekeyhq/kit-bg/src/services/ServiceHTTP';
import { MigrateNotificationNames } from '@onekeyhq/kit-bg/src/services/ServiceMigrate';
import type { MigrateNotificationData } from '@onekeyhq/kit-bg/src/services/ServiceMigrate';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import { RootRoutes } from '@onekeyhq/kit/src/routes/types';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { gotoScanQrcode } from '../../../../../utils/gotoScanQrcode';
import { EOnboardingRoutes } from '../../../routes/enums';
import { OneKeyMigrateQRCodePrefix, parseDeviceInfo } from '../util';

import { ExportResult, useConnectServer, useExportData } from './hook';
import { showSendDataRequestModal } from './SendDataRequestModal';

function hostWithURL(url: string) {
  let res = url;
  if (url.startsWith('http://')) {
    res = res.replace('http://', '');
  }
  if (url.endsWith('/')) {
    res = res.substring(0, res.length - 1);
  }
  return res;
}

const QRCodeView: FC<{ serverAddress: string }> = ({ serverAddress }) => {
  const intl = useIntl();
  const { serviceHTTP } = backgroundApiProxy;

  const { exportDataRequest } = useExportData();

  const navigation = useNavigation();

  const showModal = useRef<boolean>(false);

  const httpServerRequest = useCallback(
    (request: MigrateNotificationData) => {
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
              serviceHTTP.serverRespond({
                requestId,
                respondData: { success: true },
              });
            } else {
              serviceHTTP.serverRespond({
                requestId,
                respondData: {
                  success: false,
                  data: 'can not fount public/private.',
                },
              });
              throw new Error(`can not fount public/private.`);
            }
          } else {
            serviceHTTP.serverRespond({
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
        if (typeof clientInfo === 'string' && showModal.current === false) {
          const json = JSON.parse(clientInfo) as DeviceInfo;
          showModal.current = true;
          showSendDataRequestModal({
            deviceInfo: json,
            confirmPress: async (isConfirm) => {
              showModal.current = false;
              if (isConfirm) {
                const { status, data: exportData } = await exportDataRequest();
                if (status === ExportResult.SUCCESS && data) {
                  serviceHTTP.serverRespond({
                    requestId,
                    respondData: { success: true, data: exportData },
                  });
                  ToastManager.show({
                    title: `🧙 ${intl.formatMessage(
                      {
                        id: 'msg__data_sent_to_platform',
                      },
                      { platform: parseDeviceInfo(json).name },
                    )}`,
                  });
                  return true;
                }
                if (status === ExportResult.EMPTY) {
                  ToastManager.show({
                    title: intl.formatMessage({
                      id: 'msg__no_data_available',
                    }),
                  });
                }
                return false;
              }
              serviceHTTP.serverRespond({
                requestId,
                respondData: { success: false },
              });
              return true;
            },
          });
        }
      }
    },
    [exportDataRequest, intl, navigation, serviceHTTP],
  );

  useEffect(() => {
    appUIEventBus.on(AppUIEventBusNames.Migrate, httpServerRequest);
    return () => {
      appUIEventBus.removeAllListeners(AppUIEventBusNames.Migrate);
    };
  }, [httpServerRequest]);

  return (
    <>
      {serverAddress.length > 0 ? (
        <Box
          borderRadius="24px"
          bgColor="#FFFFFF"
          padding="11px"
          size="192px"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-subdued"
          shadow="depth.1"
        >
          <QRCode
            value={`${OneKeyMigrateQRCodePrefix}${serverAddress}`}
            size={170}
            logo={qrcodeLogo}
            logoSize={36}
            logoMargin={5}
            logoBackgroundColor="white"
          />
        </Box>
      ) : (
        <CustomSkeleton borderRadius="12px" width={192} height={192} />
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
          <Icon name="LinkMini" size={20} color="icon-subdued" />
          <Text ml="8px" typography="Body1Strong">
            {hostWithURL(serverAddress)}
          </Text>
        </Pressable>
      ) : (
        <Skeleton shape="Body1" />
      )}
    </>
  );
};

const MemoQRcodeView = memo(QRCodeView);

const EnterLinkView: FC = () => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const { connectServer } = useConnectServer();

  const isDisabled = useMemo(() => {
    if (value.replaceAll(' ', '').length === 0) {
      return true;
    }
    return false;
  }, [value]);

  return (
    <>
      <Input
        leftIconName="LinkSolid"
        rightCustomElement={
          <IconButton
            size="xl"
            name="ViewfinderCircleOutline"
            type="plain"
            onPress={() => {
              gotoScanQrcode((data) => {
                if (data.startsWith(OneKeyMigrateQRCodePrefix)) {
                  setValue(data.replace(OneKeyMigrateQRCodePrefix, ''));
                }
              });
            }}
          />
        }
        size="xl"
        w="full"
        type="text"
        value={value}
        placeholder={`${intl.formatMessage({
          id: 'content__example_shortcut',
        })} 192.168.5.178:2997`}
        onChangeText={setValue}
      />
      <Button
        type="primary"
        size="xl"
        w="full"
        isDisabled={isDisabled}
        mt="16px"
        onPromise={async () => {
          await connectServer(value);
        }}
      >
        {intl.formatMessage({ id: 'action__connect' })}
      </Button>
    </>
  );
};

const SecondaryContent: FC<{
  selectRange: number;
  onChange: (index: number) => void;
}> = ({ selectRange, onChange }) => {
  const intl = useIntl();
  const { serviceHTTP } = backgroundApiProxy;

  const [serverAddress, updateServerAddress] = useState('');
  const startHttpServer = useCallback(async () => {
    const serverUrl = await serviceHTTP.startHttpServer();
    if (serverUrl) {
      debugLogger.migrate.info('startHttpServer', serverUrl);

      updateServerAddress(serverUrl);
      return true;
    }
    return false;
  }, [serviceHTTP]);

  useEffect(() => {
    if (selectRange === 0) {
      startHttpServer();
    } else {
      serviceHTTP.stopHttpServer();
      updateServerAddress('');
    }
  }, [selectRange, serviceHTTP, startHttpServer]);

  return (
    <>
      {httpServerEnable() ? (
        <Center mb="16px">
          <SegmentedControl
            selectedIndex={selectRange}
            onChange={onChange}
            values={[
              intl.formatMessage({ id: 'content__qr_code' }),
              intl.formatMessage({ id: 'content__enter_link' }),
            ]}
            style={{ width: 192 }}
          />
        </Center>
      ) : null}

      <Center flex={1}>
        {selectRange === 0 ? (
          <MemoQRcodeView serverAddress={serverAddress} />
        ) : (
          <EnterLinkView />
        )}
      </Center>
    </>
  );
};

export default SecondaryContent;
