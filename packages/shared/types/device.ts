import type { ILocaleSymbol } from '@onekeyhq/components';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IOneKeyDeviceType } from '.';
import type {
  CommonParams,
  Response,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';

export type IDeviceResponseUnsuccessful = Unsuccessful;
export type IDeviceResponseSuccess<T> = Success<T>;
export type IDeviceResponse<T> = Response<T>;
export type IDeviceResponseResult<T> =
  | IDeviceResponseUnsuccessful
  | IDeviceResponseSuccess<T>;
export type IDevicePassphraseParams = {
  passphraseState: string | undefined;
  useEmptyPassphrase: boolean | undefined;
};
export type IDeviceCommonParams = IDevicePassphraseParams;
export type IDeviceCommonParamsFull = CommonParams;

export type IDeviceSharedCallParams = {
  dbDevice: IDBDevice;
  // type: 'SEARCH_ACCOUNTS' | 'ADD_ACCOUNTS'; // for hardware?
  confirmOnDevice?: boolean;
  deviceCommonParams?: IDeviceCommonParams;
};

export type IHardwareUiEventPayload = {
  type?: string;
  deviceType?: IOneKeyDeviceType;
  deviceId: string;
  deviceConnectId: string;
  deviceBootLoaderMode?: boolean;
  passphraseState?: string; // use passphrase, REQUEST_PASSPHRASE_ON_DEVICE only
  supportInputPinOnSoftware?: boolean;
};

export type IHardwarePopup = {
  uiRequest?: string;
  payload?: IHardwareUiEventPayload;
  content?: string;
};
export type IPopupType = 'normal' | 'inputPin' | 'inputPassphrase';

export type IChangelog = {
  [key in ILocaleSymbol]?: string;
};

export type ISYSFirmwareInfo = {
  required: boolean;
  version: number[];
  url: string;
  fingerprint: string;
  changelog: IChangelog;
  fullResource?: string;
  fullResourceRange?: string[];
  bootloaderVersion?: number[];
  bootloaderRelatedFirmwareVersion?: number[];
  bootloaderChangelog?: IChangelog;
};

export type IBLEFirmwareInfo = {
  required: boolean;
  version: number[];
  url: string;
  webUpdate: string;
  fingerprint: string;
  fingerprintWeb: string;
  changelog: IChangelog;
};

export type IResourceUpdateInfo = {
  error: string | null;
  needUpdate: boolean;
  minVersion?: string;
  limitVersion?: string;
};

export const CUSTOM_UI_RESPONSE = {
  // monorepo custom
  CUSTOM_CANCEL: 'ui-custom_cancel',
  CUSTOM_REQUEST_PIN_ON_DEVICE: 'ui-custom_request_pin_on_device',
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
