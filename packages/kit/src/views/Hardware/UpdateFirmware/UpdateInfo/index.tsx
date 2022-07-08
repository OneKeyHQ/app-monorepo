import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Markdown,
  Modal,
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

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;
type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdateInfoModel
>;

const UpdateInfoModal: FC = () => {
  const intl = useIntl();
  const local = useLocale();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { walletId, onSuccess } = useRoute<RouteProps>().params;

  const { engine } = backgroundApiProxy;
  const { deviceUpdates } = useSettings() || {};

  const [device, setDevice] = useState<Device>();
  const [bleFirmware, setBleFirmware] = useState<BLEFirmwareInfo>();
  const [sysFirmware, setSysFirmware] = useState<SYSFirmwareInfo>();

  useEffect(() => {
    (async () => {
      const deviceByWalletId = await engine.getHWDeviceByWalletId(walletId);

      if (!deviceByWalletId) {
        navigation.goBack();
        return;
      }

      setDevice(deviceByWalletId);

      const { ble, firmware } = deviceUpdates[deviceByWalletId.mac] || {};

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
  }, [deviceUpdates, engine, intl, navigation, walletId]);

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
                customIconName="LightningBoltSolid"
                title={intl.formatMessage({
                  id: 'modal__firmware_update_hint',
                })}
              />
            </Box>

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
