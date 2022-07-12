/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC, useMemo } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hd-core';
import Modal from 'react-native-modal';
import { useDeepCompareMemo } from 'use-deep-compare';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  HardwareUiEventPayload,
  closeHardwarePopup,
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

  FIRMWARE_PROGRESS: 'ui-firmware-progress',
} as const;

export type HardwarePopupContentProps = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
};

export type HardwarePopupProps = {
  canceledOnTouchOutside?: boolean;
};

const HardwarePopup: FC<HardwarePopupProps> = () => {
  const { hardwarePopup } = useAppSelector((s) => s.hardware) || {};

  const { uiRequest, payload } = hardwarePopup;
  const uiRequestMemo = useDeepCompareMemo(() => uiRequest, [uiRequest]);

  const popupView = useMemo(() => {
    const { dispatch, serviceHardware } = backgroundApiProxy;

    const handleCancelPopup = () => {
      dispatch(closeHardwarePopup());

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

    if (uiRequestMemo === UI_REQUEST.REQUEST_PIN) {
      const deviceType = payload?.deviceType ?? 'classic';
      const onDeviceInput = true;
      if (onDeviceInput) {
        serviceHardware.sendUiResponse({
          type: UI_RESPONSE.RECEIVE_PIN,
          payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
        });
      }

      return (
        <RequestPinView
          deviceType={deviceType}
          onDeviceInput={onDeviceInput}
          onCancel={() => {
            handleCancelPopup();
          }}
          onConfirm={(pin) => {
            serviceHardware?.sendUiResponse({
              type: UI_RESPONSE.RECEIVE_PIN,
              payload: pin,
            });
          }}
        />
      );
    }

    if (uiRequestMemo === UI_REQUEST.REQUEST_BUTTON) {
      const deviceType = payload?.deviceType ?? 'classic';

      return (
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
      uiRequestMemo !== UI_REQUEST.LOCATION_PERMISSION &&
      uiRequestMemo !== UI_REQUEST.BLUETOOTH_PERMISSION
    ) {
      dispatch(closeHardwarePopup());
    }

    return null;
  }, [
    payload?.deviceBootLoaderMode,
    payload?.deviceConnectId,
    payload?.deviceType,
    uiRequestMemo,
  ]);

  if (!popupView) return null;

  return (
    <Modal
      backdropColor="overlay"
      animationOut="fadeOutDown"
      animationIn="fadeInDown"
      animationOutTiming={300}
      backdropTransitionOutTiming={0}
      coverScreen
      useNativeDriver
      hideModalContentWhileAnimating
      isVisible={!!popupView}
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        top: platformEnv.isNativeIOS ? 16 : 10,
      }}
    >
      {popupView}
    </Modal>
  );
};

export default HardwarePopup;
