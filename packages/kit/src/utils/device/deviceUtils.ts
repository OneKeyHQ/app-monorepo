import OneKeyConnect, { Features } from '@onekeyfe/js-sdk';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import bleUtils, { BleDevice } from '../ble/utils';

import { getDeviceType } from './ble/OnekeyHardware';
import './deviceConnection';

let timeoutId: ReturnType<typeof setInterval>;

export type ScannedDevice =
  | BleDevice
  | (Features & { id: string; name: string });

class DeviceUtils {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(_id?: string): Promise<void> {
    return Promise.resolve();
  }
}

const deviceUtilInstance = platformEnv.isNative ? bleUtils : new DeviceUtils();
export default deviceUtilInstance;
