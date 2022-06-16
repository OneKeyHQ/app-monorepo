import { UI_REQUEST, UI_RESPONSE } from '@onekeyfe/hd-core';

import { ToastManager } from '@onekeyhq/components';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';

import deviceUtils from './deviceUtils';
import { getHardwareSDKInstance } from './hardwareInstance';

export const UIResponse = async (event: any) => {
  const HardwareSDK = await getHardwareSDKInstance();

  const { type } = event;

  switch (type) {
    case UI_REQUEST.REQUEST_PIN:
      ToastManager.show(
        {
          deviceType: deviceUtils?.connectedDeviceType,
        },
        {
          autoHide: false,
          type: 'enterPinOnDevice',
        },
      );

      HardwareSDK.uiResponse({
        type: UI_RESPONSE.RECEIVE_PIN,
        payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
      });
      break;

    case UI_REQUEST.INVALID_PIN: {
      ToastManager.hide();
      navigationRef.current?.goBack?.();
      break;
    }

    case UI_REQUEST.REQUEST_BUTTON:
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

    case UI_REQUEST.CLOSE_UI_WINDOW: {
      ToastManager.hide();
      break;
    }

    default:
      break;
  }
};
