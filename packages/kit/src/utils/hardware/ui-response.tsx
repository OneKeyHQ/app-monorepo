import React from 'react';

import { UI_RESPONSE } from '@onekeyfe/hd-core';

import { DialogManager, ToastManager } from '@onekeyhq/components';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';

import deviceUtils from './deviceUtils';
import { getHardwareSDKInstance } from './hardwareInstance';

export const UI_REQUEST = {
  REQUEST_PIN: 'ui-request_pin',
  INVALID_PIN: 'ui-invalid_pin',
  REQUEST_BUTTON: 'ui-button',

  CLOSE_UI_WINDOW: 'ui-close_window',

  BLUETOOTH_PERMISSION: 'ui-bluetooth_permission',
  LOCATION_PERMISSION: 'ui-location_permission',
} as const;

let showPermissionDialog = false;

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

    case UI_REQUEST.BLUETOOTH_PERMISSION: {
      if (!showPermissionDialog) {
        showPermissionDialog = true;
        DialogManager.show({
          render: (
            <PermissionDialog
              type="bluetooth"
              onClose={() => {
                navigationRef.current?.goBack?.();
                showPermissionDialog = false;
              }}
            />
          ),
        });
      }
      break;
    }

    case UI_REQUEST.LOCATION_PERMISSION: {
      // TODO: request location permission
      break;
    }

    default:
      break;
  }
};
