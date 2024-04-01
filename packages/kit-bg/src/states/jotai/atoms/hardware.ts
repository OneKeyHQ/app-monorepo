/* eslint-disable @typescript-eslint/no-unused-vars */

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IDeviceType } from '@onekeyfe/hd-core';

export enum EHardwareUiStateAction {
  DeviceChecking = 'DeviceChecking',
  EnterPinOnDevice = 'EnterPinOnDevice',
  ProcessLoading = 'ProcessLoading',

  // ----------------------------------------------

  REQUEST_PIN = 'ui-request_pin',
  INVALID_PIN = 'ui-invalid_pin',
  REQUEST_BUTTON = 'ui-button',
  REQUEST_PASSPHRASE = 'ui-request_passphrase',
  REQUEST_PASSPHRASE_ON_DEVICE = 'ui-request_passphrase_on_device',

  CLOSE_UI_WINDOW = 'ui-close_window',

  BLUETOOTH_PERMISSION = 'ui-bluetooth_permission',
  LOCATION_PERMISSION = 'ui-location_permission',
  LOCATION_SERVICE_PERMISSION = 'ui-location_service_permission',

  FIRMWARE_PROGRESS = 'ui-firmware-progress',

  PREVIOUS_ADDRESS = 'ui-previous_address_result',
}

export type IHardwareUiPayload = {
  uiRequestType: string;
  eventType: string;
  // ----------------------------------------------
  deviceType: IDeviceType;
  deviceId: string;
  connectId: string;
  isBootloaderMode?: boolean;
  passphraseState?: string; // use passphrase, REQUEST_PASSPHRASE_ON_DEVICE only
  supportInputPinOnSoftware?: boolean;
};
export type IHardwareUiState = {
  action: EHardwareUiStateAction;
  connectId: string;
  payload?: IHardwareUiPayload;
};
export const { target: hardwareUiStateAtom, use: useHardwareUiStateAtom } =
  globalAtom<IHardwareUiState | undefined>({
    initialValue: undefined,
    name: EAtomNames.hardwareUiStateAtom,
  });
