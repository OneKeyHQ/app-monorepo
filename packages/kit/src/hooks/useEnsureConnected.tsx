import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { DialogManager, ToastManager } from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NeedBridgeDialog from '@onekeyhq/kit/src/components/NeedBridgeDialog';
import { getDeviceUUID } from '@onekeyhq/kit/src/utils/hardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { CustomOneKeyHardwareError } from '../utils/hardware/errors';

type IUseEnsureConnected = {
  silent?: boolean;
};

export function useEnsureConnected(params?: IUseEnsureConnected) {
  const { silent = false } = params ?? {};
  const { engine, serviceHardware } = backgroundApiProxy;
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [confirmConnected, setConfirmConnected] = useState(false);

  function showMessage(key = 'action__connection_timeout') {
    if (silent) return;
    ToastManager.show(
      {
        title: intl.formatMessage({ id: key as unknown as any }),
      },
      { type: 'default' },
    );
  }

  async function ensureConnected(walletId: string) {
    setConfirmConnected(false);

    if (!walletId) return false;

    setLoading(true);
    const wallet = await engine.getWallet(walletId);
    const device = await engine.getHWDeviceByWalletId(walletId);

    if (!wallet || !device) {
      setLoading(false);
      setConfirmConnected(false);
      return false;
    }

    let features: IOneKeyDeviceFeatures | null = null;
    try {
      features = await serviceHardware.ensureConnected(device.mac);
    } catch (e: any) {
      const { className, code } = e || {};
      if (code === CustomOneKeyHardwareError.NeedOneKeyBridge) {
        DialogManager.show({ render: <NeedBridgeDialog /> });
        return;
      }
      if (!(className === OneKeyErrorClassNames.OneKeyAbortError)) {
        showMessage();
      }
      setLoading(false);
      setConfirmConnected(false);
      return false;
    }

    if (!features) {
      showMessage();
      setLoading(false);
      setConfirmConnected(false);
      return false;
    }

    const connectDeviceUUID = getDeviceUUID(features);
    const connectDeviceID = features.device_id;

    const diffDeviceIdAndUUID =
      device.deviceId && device.uuid
        ? connectDeviceID !== device.deviceId ||
          connectDeviceUUID !== device.uuid
        : false;

    const diffDeviceUUIDWithoutDeviceId =
      !device.deviceId && connectDeviceUUID !== device.id;

    if (diffDeviceIdAndUUID || diffDeviceUUIDWithoutDeviceId) {
      showMessage('msg__hardware_not_same');
      setLoading(false);
      setConfirmConnected(false);
      return false;
    }

    setLoading(false);
    setConfirmConnected(true);
    return true;
  }

  const abortConnect = useCallback(() => {
    serviceHardware.stopPolling();
  }, [serviceHardware]);

  return {
    ensureConnected,
    loading,
    confirmConnected,
    abortConnect,
  };
}
