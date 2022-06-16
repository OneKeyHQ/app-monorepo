import {
  Features,
  IDeviceType,
  SearchDevice,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';

import { getHardwareSDKInstance } from './hardwareInstance';

/**
 * will delete packages/kit/src/utils/device
 * so declare it here
 */
export const getDeviceType = (features?: Features): IDeviceType => {
  if (!features || typeof features !== 'object' || !features.serial_no) {
    return 'classic';
  }

  const serialNo = features.serial_no;
  const miniFlag = serialNo.slice(0, 2);
  if (miniFlag.toLowerCase() === 'mi') return 'mini';
  return 'classic';
};

export const getDeviceUUID = (features: Features) => {
  const deviceType = getDeviceType(features);
  if (deviceType === 'classic') {
    return features.onekey_serial;
  }
  return features.serial_no;
};

type IPollFn = (time?: number) => void;

const MAX_SEARCH_TRY_COUNT = 15;
const POLL_INTERVAL = 1000;
const POLL_INTERVAL_RATE = 1.5;

class DeviceUtils {
  connectedDeviceType: IDeviceType = 'classic';

  scanning = false;

  tryCount = 0;

  async getSDKInstance() {
    return getHardwareSDKInstance();
  }

  startDeviceScan(
    callback: (searchResponse: Unsuccessful | Success<SearchDevice[]>) => void,
  ) {
    const searchDevices = async () => {
      const HardwareSDK = await this.getSDKInstance();
      const searchResponse = await HardwareSDK?.searchDevices();
      callback(searchResponse);

      this.tryCount += 1;
    };

    const poll: IPollFn = async (time = POLL_INTERVAL) => {
      if (!this.scanning) {
        return;
      }
      if (this.tryCount > MAX_SEARCH_TRY_COUNT) {
        this.stopScan();
        return;
      }

      await searchDevices();

      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(time * POLL_INTERVAL_RATE)), time),
      );
    };

    this.scanning = true;
    poll();
  }

  stopScan() {
    this.scanning = false;
    this.tryCount = 0;
  }

  async connect(connectId: string) {
    const result = await this.getFeatures(connectId);
    if (result) {
      this.connectedDeviceType = getDeviceType(result);
    }
    return result !== null;
  }

  async getFeatures(connectId: string) {
    const HardwareSDK = await this.getSDKInstance();
    const response = await HardwareSDK?.getFeatures(connectId);
    if (response.success) {
      return response.payload;
    }
    return null;
  }
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
