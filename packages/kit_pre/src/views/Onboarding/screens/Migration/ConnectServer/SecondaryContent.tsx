import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
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
import { ToastManagerType } from '@onekeyhq/components/src/ToastManager';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type {
  DeviceInfo,
  MigrateData,
} from '@onekeyhq/engine/src/types/migrate';
import { MigrateErrorCode } from '@onekeyhq/engine/src/types/migrate';
import { httpServerEnable } from '@onekeyhq/kit-bg/src/services/ServiceHTTP';
import { MigrateNotificationNames } from '@onekeyhq/kit-bg/src/services/ServiceMigrate';
import type { MigrateNotificationData } from '@onekeyhq/kit-bg/src/services/ServiceMigrate';
import qrcodeLogo from '@onekeyhq/kit/assets/qrcode_logo.png';
import { RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { gotoScanQrcode } from '../../../../../utils/gotoScanQrcode';
import { EOnboardingRoutes } from '../../../routes/enums';
import {
  OneKeyMigrateQRCodePrefix,
  addressWithoutHttp,
  parseCloudData,
  parseDeviceInfo,
} from '../util';

import { ServerStatus, useMigrateContext } from './context';
import { ExportResult, useExportData } from './hook';
import { useConnectServer } from './hook.useConnectServer';
import { showSendDataRequestModal } from './SendDataRequestModal';

const QRCodeView: FC<{
  qrcode: string;
  refreshQrcode: () => Promise<void>;
}> = ({ qrcode, refreshQrcode }) => {
  const intl = useIntl();
  const { serviceHTTP, serviceMigrate } = backgroundApiProxy;

  const { exportDataRequest } = useExportData();

  const navigation = useNavigation();

  const showModal = useRef<boolean>(false);

  const copyAction = useCallback(() => {
    const copyAddress = addressWithoutHttp(qrcode);
    copyToClipboard(copyAddress);
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__copied' }),
    });
  }, [intl, qrcode]);

  const httpServerRequest = useCallback(
    (request: MigrateNotificationData) => {
      const { type, data } = request;
      if (type === MigrateNotificationNames.ReceiveDataFromClient) {
        const { postData, requestId } = data;
        try {
          if (typeof postData === 'string') {
            const json = parseCloudData(JSON.parse(postData)) as MigrateData;
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
                  data: undefined,
                  message: 'can not found public/private.',
                  code: MigrateErrorCode.DecryptFail,
                },
              });
              throw new Error(`can not found public/private.`);
            }
          } else {
            serviceHTTP.serverRespond({
              requestId,
              respondData: {
                success: false,
                data: undefined,
                message: 'postData is not string',
                code: MigrateErrorCode.DecryptFail,
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
                  const clientPubKey = await serviceMigrate.publicKey('Client');
                  const encryptData =
                    await serviceMigrate.encryptDataWithPublicKey(
                      clientPubKey,
                      JSON.stringify(exportData),
                    );
                  if (encryptData === false) {
                    serviceHTTP.serverRespond({
                      requestId,
                      respondData: {
                        success: false,
                        code: MigrateErrorCode.EncryptFail,
                      },
                    });
                    ToastManager.show(
                      {
                        title: intl.formatMessage({
                          id: 'form__failed',
                        }),
                      },
                      { type: ToastManagerType.error },
                    );
                    return false;
                  }
                  serviceHTTP.serverRespond({
                    requestId,
                    respondData: {
                      success: true,
                      data: encryptData,
                    },
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
                respondData: {
                  success: false,
                  code: MigrateErrorCode.RejectData,
                },
              });
              return true;
            },
          });
        }
      } else if (type === MigrateNotificationNames.UpdateQrcode) {
        refreshQrcode();
      }
    },
    [
      exportDataRequest,
      intl,
      navigation,
      serviceHTTP,
      serviceMigrate,
      refreshQrcode,
    ],
  );

  useEffect(() => {
    appUIEventBus.on(AppUIEventBusNames.Migrate, httpServerRequest);
    return () => {
      appUIEventBus.removeAllListeners(AppUIEventBusNames.Migrate);
    };
  }, [httpServerRequest]);

  return (
    <>
      {qrcode.length > 0 ? (
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
            value={`${OneKeyMigrateQRCodePrefix}${qrcode}`}
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

      {qrcode.length > 0 ? (
        <Pressable
          onPress={copyAction}
          flexDirection="row"
          mt="16px"
          alignItems="center"
        >
          <Icon name="LinkMini" size={20} color="icon-subdued" />
          <Text ml="8px" typography="Body1Strong">
            {qrcode}
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
  const { connectServer } = useConnectServer();
  const context = useMigrateContext()?.context;
  const setContext = useMigrateContext()?.setContext;

  const isFocused = useIsFocused();
  const isDisabled = useMemo(() => {
    if (context?.inputValue?.replaceAll(' ', '').length === 0) {
      return true;
    }
    return false;
  }, [context?.inputValue]);

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
                  if (setContext) {
                    setContext((ctx) => ({
                      ...ctx,
                      inputValue: data.replace(OneKeyMigrateQRCodePrefix, ''),
                    }));
                  }
                }
              });
            }}
          />
        }
        size="xl"
        w="full"
        type="text"
        value={context?.inputValue}
        placeholder="192.168.5.178:2997/1A2B"
        onChangeText={(text) => {
          if (setContext) {
            setContext((ctx) => ({
              ...ctx,
              inputValue: text,
            }));
          }
        }}
      />
      <Button
        type="primary"
        size="xl"
        w="full"
        isDisabled={isDisabled}
        mt="16px"
        onPromise={async () => {
          if (context) {
            const success = await connectServer(context.inputValue);
            if (!success && isFocused) {
              ToastManager.show(
                {
                  title: intl.formatMessage({
                    id: 'msg__invalid_link_or_network_error',
                  }),
                },
                { type: ToastManagerType.error },
              );
            }
          }
        }}
      >
        {intl.formatMessage({ id: 'action__connect' })}
      </Button>
    </>
  );
};

const MemoEnterLinkView = memo(EnterLinkView);

const SecondaryContent: FC = () => {
  const intl = useIntl();
  const { serviceHTTP, serviceMigrate } = backgroundApiProxy;
  const context = useMigrateContext()?.context;
  const setContext = useMigrateContext()?.setContext;

  const [qrcode, updateQrcode] = useState('');
  const serverUrlRef = useRef<string>('');
  const refreshQrcode = useCallback(async () => {
    let result = '';
    if (serverUrlRef.current.length > 0) {
      const randomNum = await serviceMigrate.generateRandomNum();
      result = `${addressWithoutHttp(serverUrlRef.current)}/${randomNum}`;
    }
    updateQrcode(result);
  }, [serviceMigrate]);

  const startHttpServer = useCallback(async () => {
    const serverUrl = await serviceHTTP.startHttpServer();

    const success = serverUrl && serverUrl.length > 0;
    serverUrlRef.current = success ? serverUrl : '';
    if (success) {
      debugLogger.migrate.info('startHttpServer', serverUrl);
      await refreshQrcode();
    }
    return success;
  }, [refreshQrcode, serviceHTTP]);

  useEffect(() => {
    if (context?.selectRange === 0) {
      startHttpServer().then((success) => {
        if (setContext) {
          setContext((ctx) => ({
            ...ctx,
            serverStatus: success ? ServerStatus.Success : ServerStatus.Fail,
          }));
        }
      });
    } else {
      serviceMigrate.clearMigrateInfo();
      serviceHTTP.stopHttpServer();
      updateQrcode('');
    }
  }, [
    context?.selectRange,
    serviceHTTP,
    serviceMigrate,
    setContext,
    startHttpServer,
  ]);

  return (
    <>
      {httpServerEnable() ? (
        <Center mb="16px">
          <SegmentedControl
            enabled={context?.serverStatus === ServerStatus.Success}
            selectedIndex={context?.selectRange}
            onChange={(index) => {
              if (setContext) {
                setContext((ctx) => ({
                  ...ctx,
                  selectRange: index,
                }));
              }
            }}
            values={[
              intl.formatMessage({ id: 'content__qr_code' }),
              intl.formatMessage({ id: 'content__enter_link' }),
            ]}
            style={{ width: 192 }}
          />
        </Center>
      ) : null}

      <Center flex={1}>
        {context?.selectRange === 0 ? (
          <MemoQRcodeView qrcode={qrcode} refreshQrcode={refreshQrcode} />
        ) : (
          <MemoEnterLinkView />
        )}
      </Center>
    </>
  );
};

export default SecondaryContent;
