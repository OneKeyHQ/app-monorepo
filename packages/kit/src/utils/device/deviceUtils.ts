import OneKeyConnect, { Features } from '@onekeyfe/js-sdk';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import bleUtils, { BleDevice } from '../ble/utils';

import { getDeviceType } from './ble/OnekeyHardware';
import './deviceConnection';

let timeoutId: ReturnType<typeof setInterval>;

export type ScannedDevice =
  | BleDevice
  | (Features & { id: string; name: string });

class DeviceUtils {
  connectedDeviceType: IOneKeyDeviceType = 'classic';

  startDeviceScan(callback: (d: ScannedDevice) => void) {
    const interval = async () => {
      const deviceFeatures = await OneKeyConnect.getFeatures({
        keepSession: false,
      });
      const features = deviceFeatures.payload as Features;
      const deviceType = getDeviceType(features);
      const device = {
        id: features.onekey_serial || features.serial_no || '',
        name:
          features.ble_name ||
          features.label ||
          `OneKey ${deviceType.toUpperCase()}`,
        ...features,
      };
      callback(device);
      timeoutId = setTimeout(interval, 5 * 1000);
    };

    interval();
  }

  stopScan() {
    clearTimeout(timeoutId);
  }

  connect(_id: string, deviceType: IOneKeyDeviceType): Promise<void> {
    this.connectedDeviceType = deviceType;
    return Promise.resolve();
  }
}

const deviceUtilInstance = platformEnv.isNative ? bleUtils : new DeviceUtils();
export default deviceUtilInstance;
