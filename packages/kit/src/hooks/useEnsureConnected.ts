import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getDeviceUUID } from '@onekeyhq/kit/src/utils/hardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

type IUseEnsureConnected = {
  silent?: boolean;
};

export function useEnsureConnected(params?: IUseEnsureConnected) {
  const { silent = false } = params ?? {};
  const { engine, serviceHardware } = backgroundApiProxy;
  const intl = useIntl();

  function showMessage(key = 'action__connection_timeout') {
    if (silent) return;
    ToastManager.show({
      title: intl.formatMessage({ id: key as unknown as any }),
    });
  }

  async function ensureConnected(walletId: string) {
    if (!walletId) return false;

    const wallet = await engine.getWallet(walletId);
    const device = await engine.getHWDeviceByWalletId(walletId);

    if (!wallet || !device) return false;

    let features: IOneKeyDeviceFeatures | null = null;
    try {
      features = await serviceHardware.ensureConnected(device.mac);
    } catch (e) {
      showMessage();
      return false;
    }

    if (!features) {
      showMessage();
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
      return false;
    }

    return true;
  }

  return {
    ensureConnected,
  };
}
