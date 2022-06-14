import { SearchDevice } from '@onekeyfe/hd-core';

import { getHardwareSDKInstance } from './hardwareInstance';

class DeviceUtils {
  async getSDKInstance() {
    return getHardwareSDKInstance();
  }

  async startDeviceScan() {
    const HardwareSDK = await this.getSDKInstance();
    const searchResponse = await HardwareSDK?.searchDevices();
    // TODO: searchDevices 不是长连接，是不是需要轮询
    console.log(searchResponse);
    return searchResponse;
  }
}

const deviceUtils = new DeviceUtils();

export type { SearchDevice };

export default deviceUtils;
