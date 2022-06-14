import { KnownDevice as Device } from '@onekeyfe/hd-core'
import { getHardwareSDKInstance } from './hardwareInstance'

class DeviceUtils {
	async getSDKInstance() {
		return await getHardwareSDKInstance()
	}

	async startDeviceScan() {
		const HardwareSDK = await this.getSDKInstance()
		const searchResponse = await HardwareSDK?.searchDevices()
		// TODO: searchDevices 不是长连接，是不是需要轮询
		return searchResponse 
	}
}

const deviceUtils = new DeviceUtils()

export default deviceUtils
