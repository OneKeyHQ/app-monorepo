import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { get } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  BottomSheetModal,
  Box,
  Button,
  Image,
  Markdown,
  Modal,
  Pressable,
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
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { deviceUtils } from '../../../../utils/hardware';

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

  const showUpdateOnDesktopModal = useCallback(() => {
    showOverlay((close) => (
      <BottomSheetModal
        title={`🌟 ${intl.formatMessage({ id: 'title__major_update' })}`}
        closeOverlay={() => {
          close?.();
          if (isSmallScreen) {
            navigation.goBack();
          }
        }}
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
                  <Pressable>
                    <Text
                      typography="Body2Underline"
                      color="interactive-default"
                    >
                      https://onekey.so/download
                    </Text>
                  </Pressable>
                ),
              },
            )}
          </Text>
        </Box>
        {/* TODO click event */}
        <Button>{intl.formatMessage({ id: 'action__close' })}</Button>
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

      const deviceFeatures = await serviceHardware.getFeatures(connectId ?? '');
      setFeatures(deviceFeatures);

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
        if (resourceInfo.error === 'USE_DESKTOP') {
          // TODO: i18n test for use desktop
          showUpdateOnDesktopModal();
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

  return (
    <Modal
      maxHeight={560}
      hideSecondaryAction
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
      scrollViewProps={{
        children: (
          <>
            <Typography.DisplayMedium textAlign="center">
              {intl.formatMessage({ id: 'modal__firmware_update' })}
            </Typography.DisplayMedium>

            <Box mt={4}>
              <Alert
                dismiss={false}
                alertType="info"
                customIconName="LightningBoltMini"
                title={intl.formatMessage({
                  id: 'modal__firmware_update_hint',
                })}
              />
            </Box>
            {!!deviceUtils.detectIsPublicBetaTouch(
              device?.uuid,
              features?.onekey_version,
            ) && (
              <Box mt={4}>
                <Alert
                  dismiss={false}
                  alertType="warn"
                  title={intl.formatMessage({
                    id: 'modal__firmware_pre_release_hint',
                  })}
                />
              </Box>
            )}

            {!bleFirmware && !sysFirmware && (
              <Box
                borderRadius="12px"
                bgColor="surface-subdued"
                py="24px"
                mt="24px"
                alignItems="center"
              >
                <Spinner size="lg" />
                <Typography.DisplayMedium mt="24px">
                  {intl.formatMessage({ id: 'modal__device_status_check' })}
                </Typography.DisplayMedium>
              </Box>
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
