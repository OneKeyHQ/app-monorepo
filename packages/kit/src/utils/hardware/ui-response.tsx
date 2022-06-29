import React from 'react';

import { UI_RESPONSE } from '@onekeyfe/hd-core';
import { PermissionsAndroid } from 'react-native';

import { DialogManager } from '@onekeyhq/components';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import deviceUtils from './deviceUtils';
import { getHardwareSDKInstance } from './hardwareInstance';
import RequestConfirmView from './RequestView/RequestConfirm';
import RequestPinView from './RequestView/RequestPin';

export const UI_REQUEST = {
  REQUEST_PIN: 'ui-request_pin',
  INVALID_PIN: 'ui-invalid_pin',
  REQUEST_BUTTON: 'ui-button',

  CLOSE_UI_WINDOW: 'ui-close_window',

  BLUETOOTH_PERMISSION: 'ui-bluetooth_permission',
  LOCATION_PERMISSION: 'ui-location_permission',
} as const;

let showPermissionDialog = false;

export const UIResponse = async (event: any, hideUiResponse?: boolean) => {
  const HardwareSDK = await getHardwareSDKInstance();

  const { type } = event;

  switch (type) {
    case UI_REQUEST.REQUEST_PIN:
      DialogManager.hide();
      DialogManager.show({
        render: (
          <RequestPinView
            deviceType={deviceUtils?.connectedDeviceType}
            onCancel={async () => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              const device = event.payload?.device || {};
              const { connectId } = device || {};

              HardwareSDK.cancel(connectId);
              await deviceUtils.getFeatures(connectId);
            }}
            onConfirm={(pin: string) => {
              HardwareSDK.uiResponse({
                type: UI_RESPONSE.RECEIVE_PIN,
                payload: pin,
              });
            }}
          />
        ),
      });
      if (hideUiResponse) {
        return;
      }
      HardwareSDK.uiResponse({
        type: UI_RESPONSE.RECEIVE_PIN,
        payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
      });
      break;

    case UI_REQUEST.INVALID_PIN: {
      DialogManager.hide();
      navigationRef.current?.goBack?.();
      break;
    }

    case UI_REQUEST.REQUEST_BUTTON:
      DialogManager.hide();
      DialogManager.show({
        render: (
          <RequestConfirmView
            deviceType={deviceUtils?.connectedDeviceType}
            onCancel={async () => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              const device = event.payload?.device || {};
              const { connectId } = device || {};

              HardwareSDK.cancel(connectId);
              await deviceUtils.getFeatures(connectId);
            }}
          />
        ),
      });
      break;

    case UI_REQUEST.CLOSE_UI_WINDOW: {
      DialogManager.hide();
      break;
    }
    case UI_REQUEST.LOCATION_PERMISSION:
    case UI_REQUEST.BLUETOOTH_PERMISSION: {
      if (showPermissionDialog) break;

      showPermissionDialog = true;

      const check = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (check || platformEnv.isNativeIOS) {
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
        return;
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        DialogManager.show({
          render: (
            <PermissionDialog
              type="location"
              onClose={() => {
                navigationRef.current?.goBack?.();
                showPermissionDialog = false;
              }}
            />
          ),
        });
      } else {
        showPermissionDialog = false;
      }
      break;
    }

    default:
      break;
  }
};
