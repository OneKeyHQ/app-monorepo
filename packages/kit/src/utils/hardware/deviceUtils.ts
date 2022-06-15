import { getHardwareSDKInstance } from './hardwareInstance';
import { IDeviceType, getDeviceType } from '@onekeyfe/hd-core'

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
    console.log(searchResponse);
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
