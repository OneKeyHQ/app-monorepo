import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  DialogManager,
  Spinner,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getDeviceUUID } from '@onekeyhq/kit/src/utils/hardware';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { CustomOneKeyHardwareError } from '../../utils/hardware/errors';
import NeedBridgeDialog from '../NeedBridgeDialog';

type HardwareControlProps = {
  walletDetail?: Wallet;
};

export const HardwareControl: FC<HardwareControlProps> = ({
  walletDetail,
  children,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const [deviceFeatures, setDeviceFeatures] = useState<IOneKeyDeviceFeatures>();

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    function throwDeviceCheckError() {
      ToastManager.show({
        title: intl.formatMessage({ id: 'action__connection_timeout' }),
      });
      safeGoBack();
    }

    async function loadDevices() {
      if (!walletDetail?.id) {
        throwDeviceCheckError();
        return;
      }

      const currentWalletDevice =
        await backgroundApiProxy.engine.getHWDeviceByWalletId(walletDetail.id);

      if (!currentWalletDevice) {
        throwDeviceCheckError();
        return;
      }

      let features: IOneKeyDeviceFeatures | null = null;
      try {
        features = await backgroundApiProxy.serviceHardware.ensureConnected(
          currentWalletDevice.mac,
        );
      } catch (e: any) {
        safeGoBack();

        const { className, key, code } = e || {};

        if (code === CustomOneKeyHardwareError.NeedOneKeyBridge) {
          DialogManager.show({ render: <NeedBridgeDialog /> });
          return;
        }

        if (className === OneKeyErrorClassNames.OneKeyAbortError) {
          return;
        }

        if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
          ToastManager.show({
            title: intl.formatMessage({ id: key }),
          });
        } else {
          ToastManager.show({
            title: intl.formatMessage({ id: 'action__connection_timeout' }),
          });
        }
        return;
      }

      if (!features) {
        ToastManager.show({
          title: intl.formatMessage({ id: 'action__connection_timeout' }),
        });
        safeGoBack();
        return;
      }
      const connectDeviceUUID = getDeviceUUID(features);
      const connectDeviceID = features.device_id;

      /**
       * New version of database, deviceId and uuid must be the same
       */
      const diffDeviceIdAndUUID =
        currentWalletDevice.deviceId && currentWalletDevice.uuid
          ? connectDeviceID !== currentWalletDevice.deviceId ||
            connectDeviceUUID !== currentWalletDevice.uuid
          : false;

      /**
       * Older versions of the database, uuid must be the same as device.id
       */
      const diffDeviceUUIDWithoutDeviceId =
        !currentWalletDevice.deviceId &&
        connectDeviceUUID !== currentWalletDevice.id;

      if (diffDeviceIdAndUUID || diffDeviceUUIDWithoutDeviceId) {
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__hardware_not_same' }),
        });
        safeGoBack();
        return;
      }
      setDeviceFeatures(features);
    }
    loadDevices();
  }, [walletDetail?.id, intl, safeGoBack]);

  const abortConnect = useCallback(
    () => backgroundApiProxy.serviceHardware.stopPolling(),
    [],
  );

  useEffect(
    () => () => {
      abortConnect();
    },
    [abortConnect],
  );

  if (deviceFeatures) {
    return (
      <Box w="full" h="full">
        {children}
      </Box>
    );
  }

  return (
    <Box h="100%" justifyContent="center" alignItems="center">
      <Spinner size="lg" />
      <Typography.DisplayMedium mt={6}>
        {intl.formatMessage({ id: 'modal__device_status_check' })}
      </Typography.DisplayMedium>
    </Box>
  );
};
