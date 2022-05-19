/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import OneKeyConnect, { Features, UiResponse } from '@onekeyfe/js-sdk';

import bleUtils from '@onekeyhq/kit/src/utils/ble/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BLEHandler from './handler';

class BleOnekeyConnect {
  initialized = false;

  async init(): Promise<boolean> {
    if (platformEnv.isRuntimeBrowser) return false;
    if (!this.initialized) {
      try {
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

  async getFeatures(device: any): Promise<Features | null> {
    await bleUtils?.connect(device.id, device.deviceType);
    await this.init();

    const features = await OneKeyConnect.getFeatures();
    if (features.success) {
      return features.payload;
    }
    return null;
  }

  async backupWallet(device: any) {
    await bleUtils?.connect(device.id, device.deviceType);
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
