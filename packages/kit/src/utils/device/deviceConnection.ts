import OneKeyConnect, { UI } from '@onekeyfe/js-sdk';

import { Toast } from '@onekeyhq/kit/src/hooks/useToast';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import bleHandler from './ble/handler';

let hasInitOneKeyConnect = false;

const CONNECT_URL = platformEnv.isDev
  ? 'https://connect.onekey.so/'
  : 'https://connect.onekey.so/';

export const UICallback = ({ type }: { type: string }) => {
  switch (type) {
    case 'ui-cancel-popup-request':
      break;
    case 'ui-device_firmware_outdated':
      break;
    case 'ui-request_pin':
      Toast.show(
        {},
        {
          autoHide: false,
          type: 'enterPinOnDevice',
        },
      );
      OneKeyConnect.uiResponse({
        type: UI.RECEIVE_PIN,
        payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
      });
      break;

    case 'ui-button':
      Toast.show(
        {},
        {
          autoHide: false,
          type: 'confirmOnDevice',
        },
      );
      break;
    case 'ui-close_window': {
      Toast.hide();
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
      connectSrc: CONNECT_URL,
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
