import OneKeyConnect, { Features, UiResponse } from '@onekeyfe/js-sdk';

import bleUtils, { BleDevice } from '@onekeyhq/kit/src/utils/ble/utils';
import { UICallback } from '@onekeyhq/kit/src/utils/device/deviceConnection';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BLEHandler } from './handler';

class BleOnekeyConnect {
  initialized = false;

  async init(): Promise<boolean> {
    if (platformEnv.isBrowser) return false;
    if (!this.initialized) {
      try {
        OneKeyConnect.on('UI_EVENT', UICallback);
        // @ts-ignore
        await OneKeyConnect.init({
          env: 'react-native',
          ble: BLEHandler,
          debug: false,
        });
        this.initialized = true;
        console.log('OneKeyConnect 初始化成功');
      } catch (error) {
        console.error('OneKeyConnect 初始化失败', error);
        return false;
      }
    }
    return true;
  }

  async getFeatures(device: BleDevice): Promise<Features | null> {
    await bleUtils?.connect(device.id);
    await this.init();

    const features = await OneKeyConnect.getFeatures({ keepSession: false });

    if (features.success) {
      return features.payload;
    }
    return null;
  }

  async backupWallet(device: BleDevice) {
    await bleUtils?.connect(device.id);
    await this.init();

    const response = await OneKeyConnect.backupDevice();
    if (response) {
      return response.payload;
    }
    return null;
  }

  sendResponse(params: UiResponse) {
    OneKeyConnect.uiResponse(params);
  }
}

export const onekeyBleConnect = new BleOnekeyConnect();
