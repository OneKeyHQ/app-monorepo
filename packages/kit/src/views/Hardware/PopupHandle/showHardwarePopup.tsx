import React, { ReactElement } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hd-core';
import { PermissionsAndroid } from 'react-native';
import Modal from 'react-native-modal';
import RootSiblingsManager from 'react-native-root-siblings';

import DialogManager from '@onekeyhq/components/src/DialogManager';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import PermissionDialog from '../../../components/PermissionDialog/PermissionDialog';
import { getAppNavigation } from '../../../hooks/useAppNavigation';

import RequestConfirmView from './RequestConfirm';
import RequestPinView from './RequestPin';

export type HardwareUiEventPayload = {
  type: string;
  deviceType: IOneKeyDeviceType;
  deviceId: string;
  deviceConnectId: string;
  deviceBootLoaderMode: boolean;
};

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
};
export type PopupType = 'normal' | 'input';

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

  FIRMWARE_PROGRESS: 'ui-firmware-progress',
} as const;

export type HardwarePopupContentProps = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
};

export type HardwarePopupProps = {
  canceledOnTouchOutside?: boolean;
  onClose?: () => void;
};

let hardwarePopupHolder: RootSiblingsManager | null = null;
export function closeHardwarePopup() {
  if (hardwarePopupHolder) {
    hardwarePopupHolder.destroy();
    hardwarePopupHolder = null;
  }
}
export default async function showHardwarePopup({
  uiRequest,
  payload,
}: HardwarePopup) {
  if (!uiRequest) {
    return;
  }
  let popupType = 'normal';
  let popupView: ReactElement | undefined;

  const { engine, serviceHardware } = backgroundApiProxy;

  const handleCancelPopup = () => {
    closeHardwarePopup();

    try {
      const connectId = payload?.deviceConnectId ?? '';
      // Cancel the process
      serviceHardware.cancel(connectId);
      // Refresh the hardware screen
      serviceHardware.getFeatures(connectId);
    } catch (e) {
      // TODO Collect the error
    }
  };

  if (uiRequest === UI_REQUEST.REQUEST_PIN) {
    const deviceType = payload?.deviceType ?? 'classic';

    let onDeviceInputPin = true;
    if (payload?.deviceId) {
      try {
        const device = await engine.getHWDeviceByDeviceId(payload?.deviceId);
        onDeviceInputPin = device?.payload?.onDeviceInputPin ?? true;
      } catch {
        onDeviceInputPin = true;
      }
    }
    popupType = onDeviceInputPin ? 'normal' : 'input';

    popupView = (
      <RequestPinView
        deviceType={deviceType}
        onDeviceInput={onDeviceInputPin}
        onCancel={() => {
          handleCancelPopup();
        }}
        onConfirm={(pin) => {
          serviceHardware?.sendUiResponse({
            type: UI_RESPONSE.RECEIVE_PIN,
            payload: pin,
          });
          closeHardwarePopup();
        }}
        onDeviceInputChange={(onDeviceInput) => {
          popupType = onDeviceInputPin ? 'normal' : 'input';
          if (!onDeviceInput) return;

          serviceHardware.sendUiResponse({
            type: UI_RESPONSE.RECEIVE_PIN,
            payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
          });
        }}
      />
    );
  }

  if (uiRequest === UI_REQUEST.REQUEST_BUTTON) {
    const deviceType = payload?.deviceType ?? 'classic';

    popupView = (
      <RequestConfirmView
        deviceType={deviceType}
        bootLoader={payload?.deviceBootLoaderMode}
        onCancel={() => {
          handleCancelPopup();
        }}
      />
    );
  }

  if (
    uiRequest === UI_REQUEST.LOCATION_PERMISSION ||
    uiRequest === UI_REQUEST.BLUETOOTH_PERMISSION
  ) {
    const check = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    if (check || platformEnv.isNativeIOS) {
      DialogManager.show({
        render: (
          <PermissionDialog
            type="bluetooth"
            onClose={() => {
              getAppNavigation().goBack();
              closeHardwarePopup();
            }}
          />
        ),
      });
      return;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    if (
      result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      result === PermissionsAndroid.RESULTS.DENIED
    ) {
      DialogManager.show({
        render: (
          <PermissionDialog
            type="location"
            onClose={() => {
              getAppNavigation()?.goBack();
              closeHardwarePopup();
            }}
          />
        ),
      });
    } else {
      closeHardwarePopup();
    }
    return;
  }

  if (!popupView) {
    return setTimeout(() => {
      closeHardwarePopup();
    }, 10);
  }

  const nativeInputContentAlign = platformEnv.isNative ? 'flex-end' : 'center';
  const modalTop = platformEnv.isNativeIOS ? 42 : 10;

  closeHardwarePopup();
  hardwarePopupHolder = new RootSiblingsManager(
    (
      <Modal
        isVisible
        onModalHide={closeHardwarePopup}
        backdropColor="overlay"
        animationOut={popupType === 'normal' ? 'fadeOutDown' : 'fadeOutUp'}
        animationIn={popupType === 'normal' ? 'fadeInDown' : 'fadeInUp'}
        animationOutTiming={300}
        backdropTransitionOutTiming={0}
        coverScreen
        useNativeDriver
        hideModalContentWhileAnimating
        style={{
          justifyContent:
            popupType === 'normal' ? 'flex-start' : nativeInputContentAlign,
          alignItems: 'center',
          padding: 0,
          margin: 0,
          top: popupType === 'normal' ? modalTop : 0,
        }}
      >
        {popupView}
      </Modal>
    ),
  );
  return hardwarePopupHolder;
}
