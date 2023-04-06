import type { ReactElement } from 'react';

import { Modal as NBModal } from 'native-base';
import { PermissionsAndroid, Platform } from 'react-native';
import Modal from 'react-native-modal';
import RootSiblingsManager from 'react-native-root-siblings';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NeedBridgeDialog from '@onekeyhq/kit/src/components/NeedBridgeDialog';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { getAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { HardwareUiEventPayload } from '@onekeyhq/kit/src/store/reducers/hardware';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showDialog } from '../../../utils/overlayUtils';

import EnterPassphraseView from './EnterPassphrase';
import HandlerClosePassphraseView from './HandlerClosePassphrase';
import HandlerFirmwareUpgradeView from './HandlerFirmwareUpgrade';
import HandlerOpenPassphraseView from './HandlerOpenPassphrase';
import RequestConfirmView from './RequestConfirm';
import RequestPassphraseOnDeviceView from './RequestPassphraseOnDevice';
import RequestPinView from './RequestPin';

export type HardwarePopup = {
  uiRequest?: string;
  payload?: HardwareUiEventPayload;
  content?: string;
};
export type PopupType = 'normal' | 'inputPin' | 'inputPassphrase';

export const CUSTOM_UI_RESPONSE = {
  // monorepo custom
  CUSTOM_CANCEL: 'ui-custom_cancel',
  CUSTOM_NEED_ONEKEY_BRIDGE: 'ui-custom_need_onekey_bridge',
  CUSTOM_FORCE_UPGRADE_FIRMWARE: 'ui-custom_force_onekey_bridge',
  CUSTOM_NEED_UPGRADE_FIRMWARE: 'ui-custom_need_upgrade_firmware',
  CUSTOM_NEED_OPEN_PASSPHRASE: 'ui-custom_need_open_passphrase',
  CUSTOM_NEED_CLOSE_PASSPHRASE: 'ui-custom_need_close_passphrase',
};

export const UI_REQUEST = {
  REQUEST_PIN: 'ui-request_pin',
  INVALID_PIN: 'ui-invalid_pin',
  REQUEST_BUTTON: 'ui-button',
  REQUEST_PASSPHRASE: 'ui-request_passphrase',
  REQUEST_PASSPHRASE_ON_DEVICE: 'ui-request_passphrase_on_device',

  CLOSE_UI_WINDOW: 'ui-close_window',

  BLUETOOTH_PERMISSION: 'ui-bluetooth_permission',
  LOCATION_PERMISSION: 'ui-location_permission',
  LOCATION_SERVICE_PERMISSION: 'ui-location_service_permission',

  FIRMWARE_PROGRESS: 'ui-firmware-progress',
} as const;

let hardwarePopupHolder: RootSiblingsManager | null = null;
export function closeHardwarePopup() {
  if (hardwarePopupHolder) {
    hardwarePopupHolder.destroy();
    hardwarePopupHolder = null;
  }
}
let lastParams = '';
let lastCallTime = 0;
export default async function showHardwarePopup({
  uiRequest,
  payload,
  content,
}: HardwarePopup) {
  if (!uiRequest) {
    return;
  }
  const currentCallTime = Date.now();
  const currentParams = JSON.stringify({ uiRequest, payload });
  if (currentCallTime - lastCallTime < 1000 && lastParams === currentParams) {
    // ignore frequent calls
    return;
  }
  lastCallTime = currentCallTime;
  lastParams = currentParams;
  let popupType: PopupType = 'normal';
  let popupView: ReactElement | undefined;

  const { engine, serviceHardware } = backgroundApiProxy;

  const handleCancelPopup = () => {
    closeHardwarePopup();

    (async () => {
      try {
        const connectId = payload?.deviceConnectId ?? '';
        // Cancel the process
        await serviceHardware.cancel(connectId);
        // Refresh the hardware screen
        await serviceHardware.getFeatures(connectId);
      } catch (e) {
        // TODO Collect the error
      }
    })();
  };

  const { UI_RESPONSE } = await CoreSDKLoader();
  if (uiRequest === UI_REQUEST.REQUEST_PIN) {
    const deviceType = payload?.deviceType ?? 'classic';

    let onDeviceInputPin = true;
    if (payload?.deviceId) {
      try {
        const device = await engine.getHWDeviceByDeviceId(payload?.deviceId);
        onDeviceInputPin =
          device?.payload?.onDeviceInputPin ??
          !payload.supportInputPinOnSoftware;
      } catch {
        onDeviceInputPin = !payload.supportInputPinOnSoftware;
      }
    }
    popupType = onDeviceInputPin ? 'normal' : 'inputPin';

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
          popupType = onDeviceInputPin ? 'normal' : 'inputPin';
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

  if (uiRequest === UI_REQUEST.REQUEST_PASSPHRASE_ON_DEVICE) {
    const deviceType = payload?.deviceType ?? 'classic';

    popupView = (
      <RequestPassphraseOnDeviceView
        connectId={payload?.deviceConnectId ?? ''}
        deviceType={deviceType}
        passphraseState={payload?.passphraseState}
        onCancel={() => {
          handleCancelPopup();
        }}
      />
    );
  }

  if (uiRequest === UI_REQUEST.REQUEST_PASSPHRASE) {
    const onPassphraseAck = (
      passphraseValue: string,
      onDeviceInput = false,
    ) => {
      serviceHardware?.sendUiResponse({
        type: UI_RESPONSE.RECEIVE_PASSPHRASE,
        payload: {
          value: onDeviceInput ? '' : passphraseValue,
          passphraseOnDevice: onDeviceInput,
          save: false,
        },
      });
      closeHardwarePopup();
    };
    popupType = 'inputPassphrase';
    popupView = (
      <EnterPassphraseView
        connectId={payload?.deviceConnectId ?? ''}
        passphraseState={payload?.passphraseState}
        onConfirm={(passphrase) => onPassphraseAck(passphrase)}
        onDeviceInput={() => onPassphraseAck('', true)}
        onCancel={() => {
          handleCancelPopup();
        }}
      />
    );
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_UPGRADE_FIRMWARE) {
    showDialog(
      <HandlerFirmwareUpgradeView
        connectId={payload?.deviceConnectId ?? ''}
        content={content ?? ''}
        onClose={() => {
          closeHardwarePopup();
        }}
      />,
    );
    return;
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_CLOSE_PASSPHRASE) {
    showDialog(
      <HandlerClosePassphraseView
        deviceConnectId={payload?.deviceConnectId ?? ''}
        onClose={() => {
          closeHardwarePopup();
        }}
      />,
    );
    return;
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_OPEN_PASSPHRASE) {
    showDialog(
      <HandlerOpenPassphraseView
        deviceConnectId={payload?.deviceConnectId ?? ''}
        onClose={() => {
          closeHardwarePopup();
        }}
      />,
    );
    return;
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_NEED_ONEKEY_BRIDGE) {
    showDialog(<NeedBridgeDialog />);
    return;
  }

  if (uiRequest === CUSTOM_UI_RESPONSE.CUSTOM_FORCE_UPGRADE_FIRMWARE) {
    showDialog(
      <HandlerFirmwareUpgradeView
        connectId={payload?.deviceConnectId ?? ''}
        content={content ?? ''}
        onClose={() => {
          closeHardwarePopup();
        }}
      />,
    );
    return;
  }

  if (
    uiRequest === UI_REQUEST.LOCATION_PERMISSION ||
    uiRequest === UI_REQUEST.BLUETOOTH_PERMISSION
  ) {
    const checkPermission = () => {
      if (Platform.Version >= 31) {
        return PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        );
      }
      return PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
    };

    const check = await checkPermission();

    if (check || platformEnv.isNativeIOS) {
      showDialog(
        <PermissionDialog
          type="bluetooth"
          onClose={() => {
            getAppNavigation().goBack();
            closeHardwarePopup();
          }}
        />,
      );
      return;
    }

    const requestPermission = () => {
      if (Platform.Version >= 31) {
        return PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        );
      }
      return PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
    };

    const result = await requestPermission();

    if (
      result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      result === PermissionsAndroid.RESULTS.DENIED
    ) {
      showDialog(
        <PermissionDialog
          type={Platform.Version >= 31 ? 'bluetooth' : 'location'}
          onClose={() => {
            getAppNavigation()?.goBack();
            closeHardwarePopup();
          }}
        />,
      );
    } else {
      closeHardwarePopup();
    }
    return;
  }

  if (uiRequest === UI_REQUEST.LOCATION_SERVICE_PERMISSION) {
    showDialog(
      <PermissionDialog
        type="locationService"
        onClose={() => {
          getAppNavigation()?.goBack();
          closeHardwarePopup();
        }}
      />,
    );
  }

  if (!popupView) {
    return setTimeout(() => {
      closeHardwarePopup();
    });
  }

  const nativeInputContentAlign = platformEnv.isNative ? 'flex-end' : 'center';
  const modalTop = platformEnv.isNativeIOS ? 42 : 10;

  setTimeout(() => {
    const modalPopup = platformEnv.isNativeIOS ? (
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
          // passphrase input modal should always be displayed at the top of the page
          justifyContent:
            popupType === 'normal' || popupType === 'inputPassphrase'
              ? 'flex-start'
              : nativeInputContentAlign,
          alignItems: 'center',
          padding: 0,
          margin: 0,
          top:
            popupType === 'normal' || popupType === 'inputPassphrase'
              ? modalTop
              : 0,
        }}
      >
        {popupView}
      </Modal>
    ) : (
      <NBModal
        isOpen
        onClose={closeHardwarePopup}
        bg="overlay"
        closeOnOverlayClick={false}
        style={{
          justifyContent:
            popupType === 'normal' || popupType === 'inputPassphrase'
              ? 'flex-start'
              : nativeInputContentAlign,
          alignItems: 'center',
          padding: 0,
          margin: 0,
          top:
            popupType === 'normal' || popupType === 'inputPassphrase'
              ? modalTop
              : 0,
        }}
      >
        {popupView}
      </NBModal>
    );
    if (hardwarePopupHolder) {
      hardwarePopupHolder.update(modalPopup);
    } else {
      hardwarePopupHolder = new RootSiblingsManager(modalPopup);
    }
  });

  return hardwarePopupHolder;
}
