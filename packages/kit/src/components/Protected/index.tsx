/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useData, useGetWalletDetail } from '@onekeyhq/kit/src/hooks/redux';
import { getDeviceUUID } from '@onekeyhq/kit/src/utils/hardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { NeedOneKeyBridge } from '../../utils/hardware/errors';
import NeedBridgeDialog from '../NeedBridgeDialog';

import Setup from './Setup';
import { ValidationFields } from './types';
import Validation from './Validation';

type ProtectedOptions = {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
};

type ProtectedProps = {
  skipSavePassword?: boolean;
  /** walletId for current flow, null means createWallet flow */
  walletId: string | null;
  field?: ValidationFields;
  children: (password: string, options: ProtectedOptions) => React.ReactNode;
};

const Protected: FC<ProtectedProps> = ({
  children,
  skipSavePassword,
  field,
  walletId,
}) => {
  const navigation = useNavigation();
  const walletDetail = useGetWalletDetail(walletId);
  const intl = useIntl();
  const { engine, serviceHardware } = backgroundApiProxy;
  const [deviceCheckSuccess, setDeviceCheckSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [withEnableAuthentication, setWithEnableAuthentication] =
    useState<boolean>();
  const [isLocalAuthentication, setLocalAuthentication] = useState<boolean>();
  const { isPasswordSet } = useData();
  const [hasPassword] = useState(isPasswordSet);

  const onValidationOk = useCallback((text: string, value?: boolean) => {
    setLocalAuthentication(value);
    setPassword(text);
  }, []);

  const onSetupOk = useCallback((text: string, value?: boolean) => {
    setWithEnableAuthentication(value);
    setPassword(text);
  }, []);

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  /**
   * Hardware Wallet dont need input password at here, hardware need to input password at device
   *
   * also if it is hardware device, need to connect bluetooth and check connection status
   */
  const isHardware = walletDetail?.type === 'hw';

  useEffect(() => {
    if (!isHardware) return;

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

      const currentWalletDevice = await engine.getHWDeviceByWalletId(
        walletDetail.id,
      );

      if (!currentWalletDevice) {
        throwDeviceCheckError();
        return;
      }

      let features: IOneKeyDeviceFeatures | null = null;
      try {
        features = await serviceHardware.ensureConnected(
          currentWalletDevice.mac,
        );
      } catch (e) {
        safeGoBack();

        if (e instanceof NeedOneKeyBridge) {
          DialogManager.show({ render: <NeedBridgeDialog /> });
          return;
        }

        if (e instanceof OneKeyHardwareError) {
          ToastManager.show({
            title: intl.formatMessage({ id: e.key }),
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
      setDeviceCheckSuccess(true);
    }
    loadDevices();
  }, [isHardware, engine, walletDetail?.id, intl, safeGoBack, serviceHardware]);

  if (password) {
    return (
      <Box w="full" h="full">
        {children(password, {
          withEnableAuthentication,
          isLocalAuthentication,
        })}
      </Box>
    );
  }

  if (isHardware) {
    if (deviceCheckSuccess) {
      return (
        <Box w="full" h="full">
          {children(password, {
            withEnableAuthentication,
            isLocalAuthentication,
          })}
        </Box>
      );
    }

    return (
      <>
        <Box h="100%" justifyContent="center" alignItems="center">
          <Spinner size="lg" />
          <Typography.DisplayMedium mt={6}>
            {intl.formatMessage({ id: 'modal__device_status_check' })}
          </Typography.DisplayMedium>
        </Box>
      </>
    );
  }

  if (hasPassword) {
    return <Validation onOk={onValidationOk} field={field} />;
  }
  return <Setup onOk={onSetupOk} skipSavePassword={skipSavePassword} />;
};

export default Protected;
export { ValidationFields };
