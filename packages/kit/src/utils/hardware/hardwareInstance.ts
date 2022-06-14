import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { CoreApi, ConnectSettings } from '@onekeyfe/hd-core'

let HardwareSDK: CoreApi

export const getHardwareSDKInstance = (): Promise<CoreApi> => {
	return new Promise(async (resolve, reject) => {
		if (HardwareSDK) {
			resolve(HardwareSDK)
			return
		} 
	
		let settings: Partial<ConnectSettings> = {
			debug: true
		}
	
		if (platformEnv.isNative) {
			console.log('will return ble-sdk')
		} else {
			HardwareSDK = (await import('@onekeyfe/hd-web-sdk')).default as unknown as CoreApi
			settings.connectSrc = 'https://localhost:8088/'
		}
	
		try {
			await HardwareSDK.init(settings)
		} catch {
			return null
		}

		/**
		 *  TODO: mock the handshake process
		 * 	important: init must be returned after the handshake
		 * 
		 */
		setTimeout(() => resolve(HardwareSDK), 3000)
	})
};

export {
	HardwareSDK
}
