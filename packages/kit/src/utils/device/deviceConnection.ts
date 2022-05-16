/* eslint-disable no-async-promise-executor */
/* eslint-disable no-plusplus */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import OneKeyConnect from '@onekeyfe/js-sdk';

import { ToastManager } from '@onekeyhq/components';
import deviceUtils from '@onekeyhq/kit/src/utils/device/deviceUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import bleHandler from './ble/handler';

let hasInitOneKeyConnect = false;

const wrappedMethods = [
  'getFeatures',
  'applySettings',
  'changePin',
  'backupDevice',
  'recoveryDevice',
] as const;

try {
  wrappedMethods.forEach((key) => {
    const original: any = OneKeyConnect[key];
    if (!original) return;
    (OneKeyConnect[key] as any) = async (params: any) => {
      async function poll(ps: any, time = 1000): Promise<any> {
        const result = await ps();
        if (result?.success) {
          return result;
        }
        return new Promise((resolve) =>
          setTimeout(() => resolve(poll(ps, time * 1.5)), time),
        );
      }

      try {
        const result = await poll(() => original(params));
        // console.log('[OneKey Connect]', key, JSON.stringify(result));
        return result;
      } catch (e) {
        console.log(e);
        // ignore error
      }
    };
  });
} catch (e) {
  // initial error
  console.log(e);
}

export const UICallback = (event: any) => {
  // console.log('[OneKey Connect], UI-EVENT', JSON.stringify(event));
  const { type } = event;
  switch (type) {
    case 'ui-cancel-popup-request':
      break;
    case 'ui-device_firmware_outdated':
      break;
    case 'ui-request_pin':
      ToastManager.show(
        {
          deviceType: deviceUtils?.connectedDeviceType,
        },
        {
          autoHide: false,
          type: 'enterPinOnDevice',
        },
      );

      OneKeyConnect.uiResponse({
        type: 'ui-receive_pin',
        payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
      });
      break;
    case 'ui-invalid_pin': {
      ToastManager.hide();
      break;
    }
    case 'ui-button':
      ToastManager.show(
        {
          deviceType: deviceUtils?.connectedDeviceType,
        },
        {
          autoHide: false,
          type: 'confirmOnDevice',
        },
      );
      break;
    case 'ui-close_window': {
      ToastManager.hide();
      break;
    }
    case 'ui-request_confirmation': {
      break;
    }
    default:
      break;
  }
};

const getConnectInstance = async (): Promise<typeof OneKeyConnect> => {
  // TODO: 需要 promise chain 确保 connect 完成之后再去进行下一步，否则这里需要 try catch
  if (hasInitOneKeyConnect) return OneKeyConnect;

  try {
    // const CONNECT_SRC = platformEnv.isDesktop ? '/static/js-sdk/' : CONNECT_URL;
    await OneKeyConnect.init({
      transportReconnect: true,
      debug: false,
      popup: false,
      webusb: false,
      env: platformEnv.isNative ? 'react-native' : 'web',
      ble: platformEnv.isNative ? bleHandler : null,
      manifest: {
        email: 'hi@onekey.so',
        appUrl: 'https://onekey.so',
      },
    });

    hasInitOneKeyConnect = true;
    return OneKeyConnect;
  } catch (e) {
    console.log(e);
    // @ts-expect-error
    return null;
  }
};

if (platformEnv.isBrowser && !platformEnv.isExtension) {
  getConnectInstance();
}

export default getConnectInstance;
