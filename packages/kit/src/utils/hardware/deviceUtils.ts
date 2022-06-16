import {
  IDeviceType,
  SearchDevice,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';

import { getHardwareSDKInstance } from './hardwareInstance';
import { getDeviceType } from './OneKeyHardware';

/**
 * will delete packages/kit/src/utils/device
 * so declare it here
 */

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

  ensureConnected(connectId: string) {
    const poll: IPollFn = async (time = POLL_INTERVAL) => {
      const feature = await this.getFeatures(connectId);
      if (feature) {
        return Promise.resolve(feature);
      }
      return new Promise((resolve: (p: void) => void) =>
        setTimeout(() => resolve(poll(time * POLL_INTERVAL_RATE)), time),
      );
    };

    return poll();
  }
}

const deviceUtils = new DeviceUtils();

export default deviceUtils;
