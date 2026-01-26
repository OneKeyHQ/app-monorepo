import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';

import type {
  BleReleaseInfoPayload,
  CommonParams,
  Features as FeaturesCore,
  IDeviceBLEFirmwareStatus,
  IDeviceType,
  KnownDevice,
  ReleaseInfoPayload,
  Response,
  SearchDevice,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';
import type { Features as FeaturesTransport } from '@onekeyfe/hd-transport';
import type { ImageSourcePropType } from 'react-native';

export type IOneKeyDeviceType = IDeviceType;

export type IOneKeyDeviceFeatures = FeaturesTransport;
export type IOneKeyDeviceFeaturesCore = FeaturesCore;
export type IOneKeyDeviceFeaturesWithAppParams = IOneKeyDeviceFeatures & {
  $app_firmware_type?: EFirmwareType;
};

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
    toVersion: string | undefined;
    toFirmwareType: EFirmwareType | undefined;
    toVersionBle: string | undefined;
    // hasUpgradeForce: boolean;
  };
}>;

export type IFirmwareReleasePayload = Omit<ReleaseInfoPayload, 'device'> & {
  features: IOneKeyDeviceFeatures | undefined;
  connectId: string | undefined;
};

export type IBleFirmwareReleasePayload = Omit<
  BleReleaseInfoPayload,
  'device'
> & {
  features: IOneKeyDeviceFeatures | undefined;
  connectId: string | undefined;
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
  fromFirmwareType: EFirmwareType | undefined;
  toVersion: string;
  toFirmwareType: EFirmwareType | undefined;
  changelog: IFirmwareChangeLog | undefined;
  releasePayload: T;
  githubReleaseUrl?: string;
};
export type IFirmwareUpdateInfo =
  IFirmwareUpdateInfoBase<IFirmwareReleasePayload>;
export type IBleFirmwareUpdateInfo =
  IFirmwareUpdateInfoBase<IBleFirmwareReleasePayload>;
export type IBootloaderUpdateInfo =
  IFirmwareUpdateInfoBase<IBootloaderReleasePayload>;

export type ICheckAllFirmwareReleaseResult = {
  hasUpgrade: boolean | undefined;
  features: IOneKeyDeviceFeatures | undefined;
  isBootloaderMode: boolean;
  deviceType: IDeviceType | undefined;
  deviceUUID: string;
  deviceName: string | undefined;
  deviceBleName: string | undefined;
  updatingConnectId: string | undefined;
  originalConnectId: string | undefined;
  updateInfos: {
    firmware: IFirmwareUpdateInfo | undefined;
    ble: IBleFirmwareUpdateInfo | undefined;
    bootloader: IBootloaderUpdateInfo | undefined;
    bridge: IHardwareBridgeReleasePayload | undefined;
  };
  totalPhase: IDeviceFirmwareType[];
};

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
export type IDeviceWebUSBParams = {
  skipWebDevicePrompt?: boolean;
};
export type IDeviceCommonParams = IDevicePassphraseParams & IDeviceWebUSBParams;
export type IDeviceCommonParamsFull = CommonParams;

export type IGetDeviceAccountDataParams = {
  connectId: string;
  deviceId: string;
  pathPrefix: string;
  pathSuffix: string;
  template: string;
  coinName: string | undefined;
  receiveAddressPath: string | undefined;
  showOnOnekeyFn: (index: number) => boolean | undefined;
};

export enum EConfirmOnDeviceType {
  EveryItem = 'EveryItem',
  LastItem = 'LastItem',
}

export type IDeviceSharedCallParams = {
  dbDevice: IDBDevice;
  dbWallet?: IDBWallet;
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

export type IHardwareGetPubOrAddressExtraInfo = {
  rootFingerprint?: number;
};

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

export type IDeviceHomeScreen = {
  deviceId: string;
  imgBase64: string;
  name: string;
};

export type IQrWalletDevice = {
  name: string; // device name like: 'OneKey Pro'
  // TODO deviceType
  deviceId: string;
  version: string;
  xfp: string; // different in passphrase
  buildBy: 'hdkey' | 'multiAccounts';
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
  BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE:
    'ui-bluetooth_characteristic_notify_change_failure',
  LOCATION_PERMISSION: 'ui-location_permission',
  LOCATION_SERVICE_PERMISSION: 'ui-location_service_permission',

  FIRMWARE_PROGRESS: 'ui-firmware-progress',
} as const;

export enum EOneKeyDeviceMode {
  bootloader = 'bootloader',
  notInitialized = 'notInitialized',
  // initialize = 'initialize',
  backupMode = 'backupMode',
  // seedless = 'seedless',
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

  SelectDeviceInBootloaderForWebDevice = 'SelectDeviceInBootloaderForWebDevice',
  SwitchFirmwareReconnectDevice = 'SwitchFirmwareReconnectDevice',

  // Touch & Pro only
  CheckLatestUiResource = 'CheckLatestUiResource',
  DownloadLatestUiResource = 'DownloadLatestUiResource',
  DownloadLatestUiResourceSuccess = 'DownloadLatestUiResourceSuccess',
  UpdateSysResource = 'UpdateSysResource',
  UpdateSysResourceSuccess = 'UpdateSysResourceSuccess',
  StartTransferData = 'StartTransferData',
  InstallingFirmware = 'InstallingFirmware',

  // For V3
  StartDownloadFirmware = 'StartDownloadFirmware',
  FinishDownloadFirmware = 'FinishDownloadFirmware',
  FirmwareUpdateCompleted = 'FirmwareUpdateCompleted',
}
/*
FirmwareUpdateV2 flow
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

/**
 * FirmwareUpdateV3 flow
   1. StartDownloadFirmware
   2. FinishDownloadFirmware
   3. AutoRebootToBootloader
   4. GoToBootloaderSuccess
   5. StartTransferData
   6. ConfirmOnDevice
   7. FirmwareUpdating
   8. FirmwareUpdateCompleted
 */

export enum EFirmwareVerifyType {
  System = 'system',
  Bluetooth = 'bluetooth',
  Bootloader = 'bootloader',
}

export interface IFirmwareVerifyInfo {
  deviceType: IDeviceType;
  type: EFirmwareVerifyType;
  version: string;
  checksum: string;
  commitId: string;
  releaseUrl: string;
}

export interface IFetchFirmwareVerifyHashParams {
  deviceType: IDeviceType;
  firmwareVersion: string;
  bluetoothVersion: string;
  bootloaderVersion: string;
  firmwareType: EFirmwareType | undefined;
}

export interface IDeviceVerifyRawVersions {
  version?: string;
  checksum?: string;
  commitId?: string;
  releaseUrl?: string;
}

export interface IDeviceVerifyVersions {
  raw: IDeviceVerifyRawVersions;
  formatted: string;
  releaseUrl?: string;
}

export interface IAllDeviceVerifyVersions {
  firmware: IDeviceVerifyVersions;
  bluetooth: IDeviceVerifyVersions;
  bootloader: IDeviceVerifyVersions;
}

export interface IDeviceVerifyVersionCompareResult {
  certificate: {
    isMatch: boolean;
    format: string;
    releaseUrl?: string;
  };
  firmware: {
    isMatch: boolean;
    format: string;
    releaseUrl?: string;
  };
  bluetooth: {
    isMatch: boolean;
    format: string;
    releaseUrl?: string;
  };
  bootloader: {
    isMatch: boolean;
    format: string;
    releaseUrl?: string;
  };
}

export type IDeviceVersionCacheInfo = {
  onekey_firmware_version: string | undefined;
  onekey_ble_version: string | undefined;
  ble_ver: string | undefined;
  onekey_boot_version: string | undefined;
  bootloader_version: string | undefined;
};

export type IFirmwareUpdateV3VersionParams = {
  connectId: string | undefined;
  bleVersion: string | undefined;
  firmwareVersion: string | undefined;
  bootloaderVersion: string | undefined;
  firmwareType: EFirmwareType | undefined;
};

export enum EHardwareCallContext {
  USER_INTERACTION = 'user_interaction',
  USER_INTERACTION_NO_BLE_DIALOG = 'user_interaction_no_ble_dialog',
  BACKGROUND_TASK = 'background_task',
  SDK_INITIALIZATION = 'sdk_initialization',
  SILENT_CALL = 'silent_call',
  UPDATE_FIRMWARE = 'update_firmware',
}

export type IHardwareCallContext = EHardwareCallContext;

export interface IConnectYourDeviceItem {
  title: string;
  src: ImageSourcePropType;
  opacity?: number;
  device: SearchDevice | KnownDevice | undefined;
}

export interface IFirmwareVerifyResult {
  verified: boolean;
  skipVerification?: boolean;
  device: SearchDevice | IDBDevice;
  payload: {
    deviceType: IDeviceType;
    data: string;
    cert: string;
    signature: string;
  };
  result:
    | {
        message?: string;
        data?: string;
        code?: number;
      }
    | undefined;
}
