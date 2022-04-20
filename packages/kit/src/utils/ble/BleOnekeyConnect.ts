import OneKeyConnect, { Features, UiResponse } from '@onekeyfe/js-sdk';

import bleUtils, { BleDevice } from '@onekeyhq/kit/src/utils/ble/utils';

import { navigationRef } from '../../navigator';
import { OnekeyHardwareModalRoutes } from '../../routes/Modal/HardwareOnekey';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';

import { BLEHandler } from './handler';

class BleOnekeyConnect {
  initialized = false;

  async init(): Promise<boolean> {
    if (!this.initialized) {
      OneKeyConnect.on('UI_EVENT', ({ event: _, ...action }) => {
        switch (action.type) {
          case 'ui-cancel-popup-request':
            // 临时解决方案，等待 UI_EVENT 发送完成后再关闭弹窗
            navigationRef.current?.goBack();
            console.log('UI_EVENT', '设备需要升级');
            break;
          // case 'ui-device_firmware_outdated':
          //   console.log('UI_EVENT', '设备需要升级');
          //   break;
          case 'ui-request_pin':
            console.log('UI_EVENT', '输入 Pin 码', action.payload.type);

            navigationRef.current?.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.OnekeyHardware,
              params: {
                screen: OnekeyHardwareModalRoutes.OnekeyHardwarePinCodeModal,
                params: { type: action.payload.type },
              },
            });
            break;

          default:
            console.log('UI_EVENT', action);
            break;
        }
      });

      OneKeyConnect.on('DEVICE_EVENT', ({ event: _, ...action }) => {
        switch (action.type) {
          case 'device-connect':
            console.log('DEVICE_EVENT', '设备连接', 'device-connect');
            break;
          case 'device-changed':
            console.log('DEVICE_EVENT', 'device-changed');
            break;

          default:
            console.log('DEVICE_EVENT', action);
            break;
        }
      });

      OneKeyConnect.on('TRANSPORT_EVENT', ({ event: _, ...action }) => {
        console.log('TRANSPORT_EVENT', action);
      });

      OneKeyConnect.on('BLOCKCHAIN_EVENT', ({ event: _, ...action }) => {
        console.log('BLOCKCHAIN_EVENT', action);
      });

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

  async getFeatures(device: BleDevice): Promise<Features | null> {
    await bleUtils?.connect(device.id);
    await this.init();

    const features = await OneKeyConnect.getFeatures();
    console.log('OneKeyConnect features', features);
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
