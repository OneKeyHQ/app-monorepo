import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { get } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Alert,
  BottomSheetModal,
  Box,
  Button,
  Empty,
  Image,
  Markdown,
  Modal,
  Spinner,
  Text,
  ToastManager,
  Typography,
  useIsVerticalLayout,
  useLocale,
} from '@onekeyhq/components';
import type { Device } from '@onekeyhq/engine/src/types/device';
import TouchConnectDesktop from '@onekeyhq/kit/assets/illus_touch_connect_desktop.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import type { HardwareUpdateRoutesParams } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';
import type {
  BLEFirmwareInfo,
  IResourceUpdateInfo,
  SYSFirmwareInfo,
} from '@onekeyhq/kit/src/utils/updates/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { deviceUtils } from '../../../../utils/hardware';
import { openUrlExternal } from '../../../../utils/openUrl';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;
type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdateInfoModel
>;

const UpdateInfoModal: FC = () => {
  const intl = useIntl();
  const local = useLocale();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isSmallScreen = useIsVerticalLayout();
  const routeParams = useRoute<RouteProps>().params;
  const { recheckFirmwareUpdate, onSuccess } = routeParams;
  const deviceId = get(routeParams, 'deviceId', null);
  const walletId = get(routeParams, 'walletId', null);

  const { engine, serviceHardware } = backgroundApiProxy;
  const { deviceUpdates } = useSettings();

  const [device, setDevice] = useState<Device>();
  const [features, setFeatures] = useState<IOneKeyDeviceFeatures>();
  const [bleFirmware, setBleFirmware] = useState<BLEFirmwareInfo>();
  const [sysFirmware, setSysFirmware] = useState<SYSFirmwareInfo>();
  const [resourceUpdateInfo, setResourceUpdateInfo] =
    useState<IResourceUpdateInfo>();
  const resourceRef = useRef<IResourceUpdateInfo>();

  const showUpdateOnDesktopModal = useCallback(() => {
    const closeOverlay = (close?: () => void) => {
      close?.();
      if (isSmallScreen) {
        navigation.goBack();
      }
    };
    showOverlay((close) => (
      <BottomSheetModal
        title={`🌟 ${intl.formatMessage({ id: 'title__major_update' })}`}
        closeOverlay={() => closeOverlay(close)}
      >
        <Box pt="8px" alignItems="center">
          <Image source={TouchConnectDesktop} w="191px" h="64px" />
        </Box>
        <Box my="24px">
          <Text typography="Body1Strong">
            {intl.formatMessage({
              id: 'content__connect_onekey_desktop_to_upgrade',
            })}
          </Text>
          <Text mt="8px" typography="Body2" color="text-subdued">
            {intl.formatMessage(
              {
                id: 'content__major_update_description',
              },
              {
                url: (
                  // TODO click event
                  <Text
                    typography="Body2Underline"
                    color="interactive-default"
                    onPress={() => {
                      openUrlExternal(
                        'https://onekey.so/zh_CN/download/?client=desktop',
                      );
                      closeOverlay(close);
                    }}
                  >
                    https://onekey.so/download
                  </Text>
                ),
                v: resourceRef.current?.limitVersion ?? '',
              },
            )}
          </Text>
        </Box>
        <Button onPress={() => closeOverlay(close)}>
          {intl.formatMessage({ id: 'action__close' })}
        </Button>
      </BottomSheetModal>
    ));
  }, [intl, isSmallScreen, navigation]);

  useEffect(() => {
    (async () => {
      let findDevice: Device | null = null;
      if (deviceId) {
        findDevice = await engine.getHWDeviceByDeviceId(deviceId);
      } else if (walletId) {
        findDevice = await engine.getHWDeviceByWalletId(walletId);
      }

      if (!findDevice) {
        navigation.goBack();
        return;
      }

      setDevice(findDevice);

      const connectId = findDevice.mac;

      let deviceFeatures: IOneKeyDeviceFeatures;
      try {
        deviceFeatures = await serviceHardware.getFeatures(connectId ?? '');
        setFeatures(deviceFeatures);
      } catch (error) {
        deviceUtils.showErrorToast(error);
        navigation.goBack();
        return;
      }

      let { ble, firmware } = deviceUpdates?.[connectId] || {};

      if (recheckFirmwareUpdate) {
        try {
          const result = await serviceHardware.checkFirmwareUpdate(connectId);
          if (result) {
            firmware = result.release;
          }
        } catch (error) {
          deviceUtils.showErrorToast(error);
        }
      }

      if (ble) {
        setBleFirmware(ble);
      } else if (firmware) {
        // firmware check update
        const resourceInfo = await deviceUtils.checkTouchNeedUpdateResource(
          deviceFeatures,
          firmware,
        );
        resourceRef.current = resourceInfo;
        if (resourceInfo.error === 'USE_DESKTOP') {
          const delay = platformEnv.isExtensionUiExpandTab ? 500 : 150;
          setTimeout(() => {
            showUpdateOnDesktopModal();
          }, delay);
          if (!isSmallScreen) {
            navigation.goBack();
          }
        }
        setSysFirmware(firmware);
        setResourceUpdateInfo(resourceInfo);
      } else {
        ToastManager.show(
          {
            title: intl.formatMessage({ id: 'msg__unknown_error' }),
          },
          {
            type: 'error',
          },
        );
        navigation.goBack();
      }
    })();
  }, [
    deviceId,
    deviceUpdates,
    engine,
    intl,
    navigation,
    recheckFirmwareUpdate,
    serviceHardware,
    walletId,
    showUpdateOnDesktopModal,
    isSmallScreen,
  ]);

  const buttonEnable = useMemo(() => {
    if (device?.deviceType !== 'touch') return true;
    return !!features;
  }, [device, features]);

  return (
    <Modal
      maxHeight={560}
      hideSecondaryAction
      header={intl.formatMessage({ id: 'modal__firmware_update' })}
      primaryActionTranslationId="action__update"
      onPrimaryActionPress={() => {
        navigation.navigate(
          HardwareUpdateModalRoutes.HardwareUpdateWarningModal,
          {
            device,
            onSuccess,
            resourceUpdateInfo,
          },
        );
      }}
      primaryActionProps={{
        isDisabled: !buttonEnable,
        isLoading: !buttonEnable,
      }}
      scrollViewProps={{
        children: (
          <>
            <Alert
              dismiss={false}
              alertType="info"
              customIconName="LightningBoltMini"
              title={intl.formatMessage({
                id: 'modal__firmware_update_hint',
              })}
            />
            {!!deviceUtils.detectIsPublicBetaTouch(
              device?.uuid,
              features?.onekey_version,
            ) && (
              <Alert
                dismiss={false}
                alertType="warn"
                title={intl.formatMessage({
                  id: 'modal__firmware_pre_release_hint',
                })}
              />
            )}

            {!bleFirmware && !sysFirmware && (
              <Empty
                icon={<Spinner mb="16px" size="lg" />}
                title={intl.formatMessage({ id: 'modal__device_status_check' })}
                subTitle={
                  device?.deviceType === 'touch'
                    ? intl.formatMessage({
                        id: 'modal__device_status_check_restart_device_to_exit_boardloader',
                      })
                    : ''
                }
                mt="24px"
                p="16px"
                borderRadius="12px"
                bgColor="surface-subdued"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="border-subdued"
              />
            )}

            {!!bleFirmware && (
              <>
                <Typography.DisplaySmall mt={6}>
                  {`🔗  ${intl.formatMessage({
                    id: 'content__bluetooth_firmware_lowercase',
                  })} ${bleFirmware?.version?.join('.') ?? ''}`}
                </Typography.DisplaySmall>
                <Markdown>
                  {bleFirmware?.changelog?.[local.locale] ??
                    bleFirmware?.changelog?.['en-US']}
                </Markdown>
              </>
            )}

            {!!sysFirmware && (
              <>
                <Typography.DisplaySmall mt={6}>
                  {`🧩  ${intl.formatMessage({
                    id: 'content__firmware_lowercase',
                  })} ${sysFirmware?.version?.join('.') ?? ''}`}
                </Typography.DisplaySmall>
                <Markdown>
                  {sysFirmware?.changelog?.[local.locale] ??
                    sysFirmware?.changelog?.['en-US']}
                </Markdown>
              </>
            )}
          </>
        ),
      }}
    />
  );
};

export default UpdateInfoModal;
