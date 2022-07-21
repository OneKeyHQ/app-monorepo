/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC, useEffect, useState } from 'react';

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
};

const HardwarePopup: FC<HardwarePopupProps> = () => {
  const { hardwarePopup } = useAppSelector((s) => s.hardware) || {};

  const { uiRequest, payload } = hardwarePopup;
  const uiRequestMemo = useDeepCompareMemo(() => uiRequest, [uiRequest]);

  const [popupType, setPopupType] = useState<PopupType>();

  const [popupView, setPopupView] = useState<JSX.Element>();

  useEffect(() => {
    (async () => {
      // reset popup type
      setPopupType('normal');

      const { dispatch, engine, serviceHardware } = backgroundApiProxy;

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

        let onDeviceInputPin = true;
        if (payload?.deviceId) {
          const device = await engine.getHWDeviceByDeviceId(payload?.deviceId);
          onDeviceInputPin = device?.payload?.onDeviceInputPin ?? true;
        }
        setPopupType(onDeviceInputPin ? 'normal' : 'input');

        return setPopupView(
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
              dispatch(closeHardwarePopup());
            }}
            onDeviceInputChange={(onDeviceInput) => {
              setPopupType(onDeviceInput ? 'normal' : 'input');
              if (!onDeviceInput) return;

              serviceHardware.sendUiResponse({
                type: UI_RESPONSE.RECEIVE_PIN,
                payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
              });
            }}
          />,
        );
      }

      if (uiRequestMemo === UI_REQUEST.REQUEST_BUTTON) {
        const deviceType = payload?.deviceType ?? 'classic';

        return setPopupView(
          <RequestConfirmView
            deviceType={deviceType}
            bootLoader={payload?.deviceBootLoaderMode}
            onCancel={() => {
              handleCancelPopup();
            }}
          />,
        );
      }

      if (
        uiRequestMemo !== UI_REQUEST.LOCATION_PERMISSION &&
        uiRequestMemo !== UI_REQUEST.BLUETOOTH_PERMISSION
      ) {
        dispatch(closeHardwarePopup());
      }

      return setPopupView(undefined);
    })();
  }, [payload, uiRequestMemo]);

  if (!popupView) return null;

  const nativeInputContentAlign = platformEnv.isNative ? 'flex-end' : 'center';
  const modalTop = platformEnv.isNativeIOS ? 42 : 10;

  return (
    <Modal
      backdropColor="overlay"
      animationOut={popupType === 'normal' ? 'fadeOutDown' : 'fadeOutUp'}
      animationIn={popupType === 'normal' ? 'fadeInDown' : 'fadeInUp'}
      animationOutTiming={300}
      backdropTransitionOutTiming={0}
      coverScreen
      useNativeDriver
      hideModalContentWhileAnimating
      isVisible={!!popupView}
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
  );
};

export default HardwarePopup;
