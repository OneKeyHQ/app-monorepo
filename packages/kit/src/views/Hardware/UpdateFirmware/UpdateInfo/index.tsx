import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { get } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Markdown,
  Modal,
  Spinner,
  ToastManager,
  Typography,
  useLocale,
} from '@onekeyhq/components';
import { Device } from '@onekeyhq/engine/src/types/device';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  HardwareUpdateModalRoutes,
  HardwareUpdateRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import type {
  BLEFirmwareInfo,
  SYSFirmwareInfo,
} from '@onekeyhq/kit/src/utils/updates/type';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { deviceUtils } from '../../../../utils/hardware';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;
type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdateInfoModel
>;

const UpdateInfoModal: FC = () => {
  const intl = useIntl();
  const local = useLocale();
  const navigation = useNavigation<NavigationProps['navigation']>();
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

      serviceHardware
        .getFeatures(connectId ?? '')
        .then((f) => {
          setFeatures(f);
        })
        .catch(() => {
          // ignore
        });

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
        setSysFirmware(firmware);
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
              <Box mt={6} alignItems="center">
                <Spinner size="lg" />
                <Typography.DisplayMedium mt={6}>
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
