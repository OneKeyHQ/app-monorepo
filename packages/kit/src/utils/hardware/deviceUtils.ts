import { Features, IDeviceType } from '@onekeyfe/hd-core';

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

class DeviceUtils {
  connectedDeviceType: IDeviceType = 'classic';

  async getSDKInstance() {
    return getHardwareSDKInstance();
  }

  async startDeviceScan() {
    const HardwareSDK = await this.getSDKInstance();
    const searchResponse = await HardwareSDK?.searchDevices();
    /**
     * searchDevices is not a long connection, is it necessary to poll
     */
    return searchResponse;
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
