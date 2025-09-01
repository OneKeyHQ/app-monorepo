/* eslint-disable @typescript-eslint/no-unused-vars */

import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  EFirmwareUpdateTipMessages,
  EOneKeyDeviceMode,
  IBleFirmwareUpdateInfo,
  IBootloaderUpdateInfo,
  IDeviceFirmwareType,
  IFirmwareUpdateInfo,
  IFirmwareUpdatesDetectStatus,
} from '@onekeyhq/shared/types/device';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IDeviceType } from '@onekeyfe/hd-core';

export enum EHardwareUiStateAction {
  DeviceChecking = 'DeviceChecking',
  EnterPinOnDevice = 'EnterPinOnDevice',
  ProcessLoading = 'ProcessLoading',

  // @onekeyfe/hd-core UI_REQUEST const map ----------------------------------------------

  REQUEST_PIN = 'ui-request_pin',
  REQUEST_PIN_TYPE_PIN_ENTRY = 'ButtonRequest_PinEntry',
  REQUEST_PIN_TYPE_ATTACH_PIN = 'ButtonRequest_AttachPin',
  INVALID_PIN = 'ui-invalid_pin',
  REQUEST_BUTTON = 'ui-button',
  REQUEST_PASSPHRASE = 'ui-request_passphrase',
  REQUEST_PASSPHRASE_ON_DEVICE = 'ui-request_passphrase_on_device',
  REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE = 'ui-request_select_device_in_bootloader_for_web_device',

  CLOSE_UI_WINDOW = 'ui-close_window',
  CLOSE_UI_PIN_WINDOW = 'ui-close_pin_window',
  DEVICE_PROGRESS = 'ui-device_progress',

  BLUETOOTH_PERMISSION = 'ui-bluetooth_permission',
  BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE = 'ui-bluetooth_characteristic_notify_change_failure',
  LOCATION_PERMISSION = 'ui-location_permission',
  LOCATION_SERVICE_PERMISSION = 'ui-location_service_permission',

  FIRMWARE_PROCESSING = 'ui-firmware-processing',
  FIRMWARE_PROGRESS = 'ui-firmware-progress',
  FIRMWARE_TIP = 'ui-firmware-tip',

  PREVIOUS_ADDRESS = 'ui-previous_address_result',

  WEB_DEVICE_PROMPT_ACCESS_PERMISSION = 'ui-web_device_prompt_access_permission',
  DESKTOP_REQUEST_BLUETOOTH_PERMISSION = 'ui-desktop_request_bluetooth_permission',
  BLUETOOTH_PERMISSION_UNAUTHORIZED = 'ui-bluetooth_permission_unauthorized',
  BLUETOOTH_DEVICE_PAIRING = 'ui-bluetooth_device_pairing',
  BLUETOOTH_UNSUPPORTED = 'ui-bluetooth_unsupported',
  BLUETOOTH_POWERED_OFF = 'ui-bluetooth_powered_off',
}

export type IHardwareUiPayload = {
  uiRequestType: string; // EHardwareUiStateAction
  eventType: string;
  // ----------------------------------------------
  deviceType: IDeviceType;
  deviceId: string;
  connectId: string;
  deviceMode: EOneKeyDeviceMode;
  isBootloaderMode?: boolean;
  // request passphrase
  passphraseState?: string; // use passphrase, REQUEST_PASSPHRASE_ON_DEVICE only
  existsAttachPinUser?: boolean; // use attach pin, REQUEST_PASSPHRASE_ON_DEVICE only
  // firmware update tip
  firmwareTipData?: {
    message: EFirmwareUpdateTipMessages | string;
  };
  // firmware update progress
  firmwareProgress?: number;
  firmwareProgressType?: 'transferData' | 'installingFirmware';
  rawPayload: any;
  // request pin type
  requestPinType?: 'PinEntry' | 'AttachPin';
  // service promise for waiting user interaction
  promiseId?: string;
};
export type IHardwareUiState = {
  action: EHardwareUiStateAction;
  connectId: string;
  payload?: IHardwareUiPayload;
};

export enum EFirmwareUpdateSteps {
  init = 'init',
  error = 'error', // error occurred in whole update process, installing phase error will use retry
  checkReleaseError = 'checkReleaseError', // check release error
  showChangeLog = 'showChangeLog',
  showCheckList = 'showCheckList',
  updateStart = 'updateStart', // updateStart
  installing = 'installing', // installingPhase: 1 boot, 2 fw res, 3 ble
  updateDone = 'updateDone', // updateDone
  requestDeviceInBootloaderForWebDevice = 'requestDeviceInBootloaderForWebDevice', // web-usb should requestDevice for bootloader mode device, cause pid was changed
}
export type IFirmwareUpdateStepInfo =
  | {
      step: EFirmwareUpdateSteps.init;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.error;
      payload: {
        error: IOneKeyError;
      };
    }
  | {
      step: EFirmwareUpdateSteps.checkReleaseError;
      payload: {
        error: IOneKeyError;
      };
    }
  | {
      step: EFirmwareUpdateSteps.showChangeLog;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.showCheckList;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.updateStart;
      payload: {
        startAtTime: number;
      };
    }
  | {
      step: EFirmwareUpdateSteps.installing;
      payload: {
        installingTarget?: {
          totalPhase: IDeviceFirmwareType[];
          currentPhase: IDeviceFirmwareType;
          updateInfo:
            | IBootloaderUpdateInfo
            | IBleFirmwareUpdateInfo
            | IFirmwareUpdateInfo;
        };
      };
    }
  | {
      step: EFirmwareUpdateSteps.updateDone;
      payload: undefined;
    }
  | {
      step: EFirmwareUpdateSteps.requestDeviceInBootloaderForWebDevice;
      payload: undefined;
    };

export type IFirmwareUpdateRetry = {
  id: number;
  error: IOneKeyError;
};

// hardware ui state ----------------------------------------------

export const { target: hardwareUiStateAtom, use: useHardwareUiStateAtom } =
  globalAtom<IHardwareUiState | undefined>({
    initialValue: undefined,
    name: EAtomNames.hardwareUiStateAtom,
  });
export const {
  target: hardwareUiStateCompletedAtom,
  use: useHardwareUiStateCompletedAtom,
} = globalAtom<IHardwareUiState | undefined>({
  initialValue: undefined,
  name: EAtomNames.hardwareUiStateCompletedAtom,
});

// firmware update ----------------------------------------------

export const {
  target: firmwareUpdatesDetectStatusPersistAtom,
  use: useFirmwareUpdatesDetectStatusPersistAtom,
} = globalAtom<IFirmwareUpdatesDetectStatus | undefined>({
  initialValue: undefined,
  name: EAtomNames.firmwareUpdatesDetectStatusPersistAtom,
  persist: true,
});

export const {
  target: firmwareUpdateRetryAtom,
  use: useFirmwareUpdateRetryAtom,
} = globalAtom<IFirmwareUpdateRetry | undefined>({
  initialValue: undefined,
  name: EAtomNames.firmwareUpdateRetryAtom,
});

export const {
  target: firmwareUpdateStepInfoAtom,
  use: useFirmwareUpdateStepInfoAtom,
} = globalAtom<IFirmwareUpdateStepInfo>({
  initialValue: {
    step: EFirmwareUpdateSteps.init,
    payload: undefined,
  },
  name: EAtomNames.firmwareUpdateStepInfoAtom,
});

export const {
  target: firmwareUpdateWorkflowRunningAtom,
  use: useFirmwareUpdateWorkflowRunningAtom,
} = globalAtom<boolean>({
  initialValue: false,
  name: EAtomNames.firmwareUpdateWorkflowRunningAtom,
});

export const {
  target: firmwareUpdateResultVerifyAtom,
  use: useFirmwareUpdateResultVerifyAtom,
} = globalAtom<
  | {
      finalBleVersion: string;
      finalFirmwareVersion: string;
      finalBootloaderVersion: string;
    }
  | undefined
>({
  initialValue: undefined,
  name: EAtomNames.firmwareUpdateResultVerifyAtom,
});

// hardware xfp generate ----------------------------------------------
export type IHardwareWalletXfpStatus = {
  [walletId: string]: {
    xfpMissing: boolean;
  };
};
export const {
  target: hardwareWalletXfpStatusAtom,
  use: useHardwareWalletXfpStatusAtom,
} = globalAtom<IHardwareWalletXfpStatus>({
  initialValue: {},
  name: EAtomNames.hardwareWalletXfpStatusAtom,
});
