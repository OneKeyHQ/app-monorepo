import { ToastManager } from '@onekeyhq/components';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import { getHardwareSDKInstance } from './hardwareInstance'
import deviceUtils from './deviceUtils'

export const UIResponse = async (event: any) => {
	const HardwareSDK = await getHardwareSDKInstance();

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

      HardwareSDK.uiResponse({
        type: 'ui-receive_pin',
        payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
      });
      break;
    case 'ui-invalid_pin': {
      ToastManager.hide();
      navigationRef.current?.goBack?.();
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
