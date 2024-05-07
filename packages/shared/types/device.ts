import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';

import type {
  BleReleaseInfoEvent,
  CommonParams,
  Features,
  IDeviceBLEFirmwareStatus,
  IDeviceType,
  ReleaseInfoEvent,
  Response,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';

export type IOneKeyDeviceType = IDeviceType;

export type IOneKeyDeviceFeatures = Features;

export type IFirmwareChangeLog = {
  [key in ILocaleSymbol]?: string;
};

export type IFirmwareUpdatesDetectResult = {
  lastDetectAt?: number;
  updateInfo?: {
    firmware?: IFirmwareUpdateInfo;
    ble?: IBleFirmwareUpdateInfo;
  };
};

export type IFirmwareUpdatesDetectMap = Partial<{
  [connectId: string]: IFirmwareUpdatesDetectResult;
}>;

export type IFirmwareUpdatesDetectStatus = Partial<{
  [connectId: string]: {
    connectId: string;
    hasUpgrade: boolean;
    // hasUpgradeForce: boolean;
  };
}>;

export type IFirmwareReleasePayload = Omit<
  ReleaseInfoEvent['payload'],
  'features'
> & {
  features: IOneKeyDeviceFeatures;
  connectId?: string;

  hasUpgradeForce?: boolean;
  hasUpgrade?: boolean;
};

export type IBleFirmwareReleasePayload = BleReleaseInfoEvent['payload'] & {
  features: IOneKeyDeviceFeatures;
  connectId?: string;
};
// TODO should export sdk type CheckBootloaderReleaseResponse
export type IBootloaderReleasePayload = {
  shouldUpdate: boolean;
  status: IDeviceBLEFirmwareStatus;
  release: IFirmwareReleasePayload['release'];
  bootloaderMode: boolean;
};
// TODO should export sdk type CheckBridgeReleaseResponse
export type IHardwareBridgeReleasePayload = {
  shouldUpdate: boolean;
  status: 'outdated' | 'valid';
  releaseVersion: string;
};

type IFirmwareUpdateInfoBase<T> = {
  connectId: string | undefined;
  hasUpgrade: boolean;
  hasUpgradeForce: boolean;
  firmwareType: IDeviceFirmwareType;
  fromVersion: string;
  toVersion: string;
  changelog: IFirmwareChangeLog | undefined;
  releasePayload: T;
};
export type IFirmwareUpdateInfo =
  IFirmwareUpdateInfoBase<IFirmwareReleasePayload>;
export type IBleFirmwareUpdateInfo =
  IFirmwareUpdateInfoBase<IBleFirmwareReleasePayload>;
export type IBootloaderUpdateInfo =
  IFirmwareUpdateInfoBase<IBootloaderReleasePayload>;

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

export type IGetDeviceAccountDataParams = {
  connectId: string;
  deviceId: string;
  pathPrefix: string;
  pathSuffix: string;
  coinName: string | undefined;
  showOnOnekeyFn: (index: number) => boolean | undefined;
};

export enum EConfirmOnDeviceType {
  EveryItem = 'EveryItem',
  LastItem = 'LastItem',
}

export type IDeviceSharedCallParams = {
  dbDevice: IDBDevice;
  // type: 'SEARCH_ACCOUNTS' | 'ADD_ACCOUNTS'; // for hardware?
  confirmOnDevice?: EConfirmOnDeviceType;
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

export type ISYSFirmwareInfo = {
  required: boolean;
  version: number[];
  url: string;
  fingerprint: string;
  changelog: IFirmwareChangeLog;
  fullResource?: string;
  fullResourceRange?: string[];
  bootloaderVersion?: number[];
  bootloaderRelatedFirmwareVersion?: number[];
  bootloaderChangelog?: IFirmwareChangeLog;
};

export type IBLEFirmwareInfo = {
  required: boolean;
  version: number[];
  url: string;
  webUpdate: string;
  fingerprint: string;
  fingerprintWeb: string;
  changelog: IFirmwareChangeLog;
};

export type IResourceUpdateInfo = {
  error: string | null;
  needUpdate: boolean;
  minVersion?: string;
  limitVersion?: string;
};

export type IDeviceFirmwareType = 'firmware' | 'ble' | 'bootloader';

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

export enum EOneKeyDeviceMode {
  bootloader = 'bootloader',
  initialize = 'initialize',
  seedless = 'seedless',
  normal = 'normal',
}

// check this.postTipMessage('AutoRebootToBootloader'); from sdk/hd-core
export enum EFirmwareUpdateTipMessages {
  AutoRebootToBootloader = 'AutoRebootToBootloader',
  GoToBootloaderSuccess = 'GoToBootloaderSuccess',
  DownloadFirmware = 'DownloadFirmware',
  DownloadFirmwareSuccess = 'DownloadFirmwareSuccess',
  DownloadLatestBootloaderResource = 'DownloadLatestBootloaderResource',
  DownloadLatestBootloaderResourceSuccess = 'DownloadLatestBootloaderResourceSuccess',

  ConfirmOnDevice = 'ConfirmOnDevice',

  FirmwareEraseSuccess = 'FirmwareEraseSuccess',

  // Touch & Pro only
  CheckLatestUiResource = 'CheckLatestUiResource',
  DownloadLatestUiResource = 'DownloadLatestUiResource',
  DownloadLatestUiResourceSuccess = 'DownloadLatestUiResourceSuccess',
  UpdateSysResource = 'UpdateSysResource',
  UpdateSysResourceSuccess = 'UpdateSysResourceSuccess',
  StartTransferData = 'StartTransferData',
  InstallingFirmware = 'InstallingFirmware',
}
/*
,AutoRebootToBootloader,GoToBootloaderSuccess,DownloadFirmware,DownloadFirmwareSuccess,ConfirmOnDevice,FirmwareEraseSuccess,AutoRebootToBootloader,GoToBootloaderSuccess,DownloadFirmware,DownloadFirmwareSuccess,ConfirmOnDevice,FirmwareEraseSuccess

1. CheckLatestUiResource
2. DownloadLatestUiResource
3. DownloadLatestUiResourceSuccess
4. UpdateSysResource
5. UpdateSysResourceSuccess
6. AutoRebootToBootloader
7. GoToBootloaderSuccess
8. DownloadFirmware
9. DownloadFirmwareSuccess
10. StartTransferData
11. ConfirmOnDevice
12. InstallingFirmware
*/
