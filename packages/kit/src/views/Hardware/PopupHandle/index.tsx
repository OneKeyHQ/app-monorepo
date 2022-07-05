/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC, useEffect, useState } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hd-core';
import { PermissionsAndroid } from 'react-native';

import { DialogManager } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import {
  cancelHardwarePopup,
  closeHardwarePopup,
  visibleHardwarePopup,
} from '@onekeyhq/kit/src/store/reducers/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import RequestConfirmView from './RequestConfirm';
import RequestPinView from './RequestPin';

export const CUSTOM_UI_RESPONSE = {
  // monorepo custom
  CUSTOM_CANCEL: 'ui-custom_cancel',
};

export const UI_REQUEST = {
  REQUEST_PIN: 'ui-request_pin',
  INVALID_PIN: 'ui-invalid_pin',
  REQUEST_BUTTON: 'ui-button',

  CLOSE_UI_WINDOW: 'ui-close_window',

  BLUETOOTH_PERMISSION: 'ui-bluetooth_permission',
  LOCATION_PERMISSION: 'ui-location_permission',
} as const;

const PopupHandle: FC = () => {
  const { hardwarePopup } = useAppSelector((s) => s.hardware) || {};
  const { dispatch, serviceHardware } = backgroundApiProxy;
  const [currentPopupType, setCurrentPopupType] = useState<string>();

  const { uiRequest, payload, visible } = hardwarePopup;

  useEffect(() => {
    console.log('PopupHandle:', uiRequest, payload, visible);

    if (uiRequest === UI_REQUEST.REQUEST_PIN) {
      if (visible) return;
      dispatch(visibleHardwarePopup(uiRequest));
      setCurrentPopupType(uiRequest);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const device = payload?.device || {};
      const { deviceType } = device || {};
      const onDeviceInput = true;

      if (onDeviceInput) {
        serviceHardware.sendUiResponse({
          type: UI_RESPONSE.RECEIVE_PIN,
          payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
        });
      }

      DialogManager.hide();
      DialogManager.show({
        render: (
          <RequestPinView
            deviceType={deviceType}
            onDeviceInput={onDeviceInput}
            onCancel={() => {
              dispatch(cancelHardwarePopup());
            }}
            onConfirm={(pin) => {
              serviceHardware?.sendUiResponse({
                type: UI_RESPONSE.RECEIVE_PIN,
                payload: pin,
              });
            }}
          />
        ),
      });
    }

    if (uiRequest === UI_REQUEST.INVALID_PIN) {
      dispatch(closeHardwarePopup());
      DialogManager.hide();
    }

    if (uiRequest === UI_REQUEST.REQUEST_BUTTON) {
      if (visible) return;
      dispatch(visibleHardwarePopup(uiRequest));
      setCurrentPopupType(uiRequest);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const device = payload?.device || {};
      const { deviceType } = device || {};

      DialogManager.hide();
      setTimeout(() => {
        DialogManager.show({
          render: (
            <RequestConfirmView
              deviceType={deviceType}
              onCancel={() => {
                dispatch(cancelHardwarePopup());
              }}
            />
          ),
        });
      }, 0);
    }

    if (uiRequest === UI_REQUEST.CLOSE_UI_WINDOW) {
      dispatch(closeHardwarePopup());
      if (
        currentPopupType === UI_REQUEST.BLUETOOTH_PERMISSION ||
        currentPopupType === UI_REQUEST.LOCATION_PERMISSION
      ) {
        // Users manually shut it down
        return;
      }

      DialogManager.hide();
      setCurrentPopupType(undefined);
    }

    if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_CANCEL) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const device = payload?.device || {};
      const { connectId } = device || {};

      serviceHardware.cancel(connectId);
      serviceHardware.getFeatures(connectId);

      dispatch(closeHardwarePopup());
      DialogManager.hide();
    }

    if (
      uiRequest === UI_REQUEST.LOCATION_PERMISSION ||
      uiRequest === UI_REQUEST.BLUETOOTH_PERMISSION
    ) {
      (async () => {
        if (visible) return;
        setCurrentPopupType(uiRequest);

        const check = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        if (check || platformEnv.isNativeIOS) {
          setTimeout(() => {
            dispatch(visibleHardwarePopup(uiRequest));
            DialogManager.show({
              render: (
                <PermissionDialog
                  type="bluetooth"
                  onClose={() => {
                    navigationRef.current?.goBack?.();
                    setCurrentPopupType(undefined);
                    dispatch(closeHardwarePopup());
                  }}
                />
              ),
            });
          }, 0);
          return;
        }

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        if (
          result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
          result === PermissionsAndroid.RESULTS.DENIED
        ) {
          setTimeout(() => {
            dispatch(visibleHardwarePopup(uiRequest));
            DialogManager.show({
              render: (
                <PermissionDialog
                  type="location"
                  onClose={() => {
                    navigationRef.current?.goBack?.();
                    setCurrentPopupType(undefined);
                    dispatch(closeHardwarePopup());
                  }}
                />
              ),
            });
          }, 0);
        } else {
          dispatch(closeHardwarePopup());
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiRequest, visible]);

  return null;
};

export default PopupHandle;
