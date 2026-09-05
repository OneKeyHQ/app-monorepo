import {
  EDeviceType,
  EFirmwareType,
  type HardwareConnectProtocol,
  canonicalizePro2BleAdvertisementName,
} from '@onekeyfe/hd-shared';
import semver from 'semver';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { EHardwareTransportType } from '../../types';
import {
  EFirmwareUpdateTipMessages,
  EFirmwareVerifyType,
  EHardwareVendor,
  EOneKeyDeviceMode,
} from '../../types/device';
import { EHardwareUiStateAction } from '../../types/hardwareUi';
import { CoreSDKLoader } from '../hardware/instance';
import platformEnv from '../platformEnv';

import { DeviceScannerUtils } from './DeviceScannerUtils';
import {
  NEO_DEVICE_TYPE,
  isProtocolV2ProductType,
} from './hardwareDeviceTypes';

import type {
  IAllDeviceVerifyVersions,
  IDeviceVerifyRawVersions,
  IDeviceVerifyVersions,
  IFetchFirmwareVerifyHashParams,
  IFirmwareVerifyInfo,
  IOneKeyDeviceFeatures,
  IOneKeyDeviceFeaturesWithAppParams,
  IOneKeyDeviceType,
} from '../../types/device';
import type {
  DeviceSettingsProtocol,
  DeviceState,
  Features,
  IDeviceType,
  KnownDevice,
  OnekeyFeatures,
  SearchDevice,
} from '@onekeyfe/hd-core';

type IRawOnekeyFeaturesForVerify = OnekeyFeatures & {
  fw_vendor?: string | null;
};

export { EHardwareUiStateAction };

type IGetDeviceVersionParams = {
  device: IDBDevice | Omit<SearchDevice, 'commType'> | undefined;
  features: IOneKeyDeviceFeatures | undefined;
};

function getDefaultDeviceLabel(deviceType: IDeviceType): string {
  if (deviceType === NEO_DEVICE_TYPE) {
    return 'OneKey Neo';
  }
  const defaultLabelsByDeviceType: Record<IOneKeyDeviceType, string> = {
    [EDeviceType.Classic]: 'OneKey Classic',
    [EDeviceType.Classic1s]: 'OneKey Classic 1S',
    [EDeviceType.ClassicPure]: 'OneKey Classic 1S Pure',
    [EDeviceType.Mini]: 'OneKey Mini',
    [EDeviceType.Touch]: 'OneKey Touch',
    [EDeviceType.Pro]: 'OneKey Pro',
    [EDeviceType.Pro2]: 'OneKey Pro 2',
    [NEO_DEVICE_TYPE]: 'OneKey Neo',
    [EDeviceType.Unknown]: '',
  };
  return defaultLabelsByDeviceType[deviceType] || '';
}

function canonicalizeBleNameForDevice(name: string, deviceType?: IDeviceType) {
  return deviceType === EDeviceType.Pro2
    ? canonicalizePro2BleAdvertisementName(name)
    : name;
}

function getDeviceDisplayName({ state }: { state: DeviceState }): string {
  const { identity } = state;
  const defaultName = identity.deviceType
    ? getDefaultDeviceLabel(identity.deviceType)
    : undefined;
  return (
    identity.label ||
    (identity.bleName
      ? canonicalizeBleNameForDevice(identity.bleName, identity.deviceType)
      : undefined) ||
    defaultName ||
    identity.model ||
    'OneKey'
  );
}

function getDeviceVersionsFromState({ state }: { state: DeviceState }) {
  return {
    bleVersion: state.versions.ble || '',
    firmwareVersion: state.versions.firmware || '',
    bootloaderVersion: state.versions.bootloader || '',
  };
}

// TODO move to db converter
function dbDeviceToSearchDevice(device: IDBDevice) {
  const result: Omit<SearchDevice, 'commType'> & {
    serialNo: string;
  } = {
    ...device,
    connectId: device.connectId,
    serialNo: device.uuid,
    uuid: device.uuid,
    deviceId: device.deviceId,
    deviceType: device.deviceType,
    name: device.name,
  };
  return result;
}

function getDeviceSerialNoFromFeatures(
  features: IOneKeyDeviceFeatures | undefined,
) {
  if (!features) {
    return undefined;
  }
  const compatibleFeatures = features as IOneKeyDeviceFeatures & {
    onekey_serial?: string;
    onekey_serial_no?: string;
    serial_no?: string;
  };
  return [
    compatibleFeatures.serialNo,
    compatibleFeatures.onekey_serial_no,
    compatibleFeatures.onekey_serial,
    compatibleFeatures.serial_no,
  ].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function isSamePhysicalDevice(
  device: Partial<IDBDevice> | undefined,
  other: Partial<IDBDevice> | undefined,
): boolean {
  if (
    !device ||
    !other ||
    (device.vendor ?? EHardwareVendor.onekey) !==
      (other.vendor ?? EHardwareVendor.onekey)
  ) {
    return false;
  }
  if (device.id && device.id === other.id) {
    return true;
  }
  const serialNo =
    device.uuid ||
    device.deviceStateInfo?.identity.serialNo ||
    getDeviceSerialNoFromFeatures(device.featuresInfo);
  const otherSerialNo =
    other.uuid ||
    other.deviceStateInfo?.identity.serialNo ||
    getDeviceSerialNoFromFeatures(other.featuresInfo);
  // A reset changes the wallet identity and may also clear transport aliases.
  if (serialNo && otherSerialNo) {
    return serialNo === otherSerialNo;
  }
  if (device.deviceId && device.deviceId === other.deviceId) {
    return true;
  }
  const connectIds = new Set(
    [device.connectId, device.usbConnectId, device.bleConnectId]
      .filter(Boolean)
      .map((value) => value?.toLowerCase()),
  );
  return [other.connectId, other.usbConnectId, other.bleConnectId].some(
    (value) => Boolean(value && connectIds.has(value.toLowerCase())),
  );
}

function getDeviceBleNameFromFeatures(
  features: IOneKeyDeviceFeatures | undefined,
) {
  if (!features) {
    return undefined;
  }
  const compatibleFeatures = features as IOneKeyDeviceFeatures & {
    ble_name?: string;
    onekey_ble_name?: string;
  };
  const bleName = [
    compatibleFeatures.bleName,
    compatibleFeatures.onekey_ble_name,
    compatibleFeatures.ble_name,
  ].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return bleName
    ? canonicalizeBleNameForDevice(bleName, compatibleFeatures.deviceType)
    : undefined;
}

// web sdk return KnownDevice
// ble sdk return SearchDevice
// db return IDBDevice
async function getDeviceVersion(params: IGetDeviceVersionParams): Promise<{
  bleVersion: string;
  firmwareVersion: string;
  bootloaderVersion: string;
}> {
  const {
    getDeviceBLEFirmwareVersion,
    getDeviceBootloaderVersion,
    getDeviceFirmwareVersion,
  } = await CoreSDKLoader();
  const { device, features } = params;
  const knownDevice = device as KnownDevice | undefined;
  const dbDevice = device as IDBDevice | undefined;
  const state =
    dbDevice?.deviceStateInfo ??
    (knownDevice as KnownDevice & { state?: DeviceState })?.state;
  if (state) {
    return getDeviceVersionsFromState({ state });
  }
  const usedFeatures =
    features || dbDevice?.featuresInfo || knownDevice?.features;

  const bootloaderVersion = usedFeatures
    ? usedFeatures?.bootloaderVersion ||
      (getDeviceBootloaderVersion(usedFeatures) || []).join('.') ||
      ''
    : '';

  const compatibleBleVersion = usedFeatures
    ? (getDeviceBLEFirmwareVersion(usedFeatures) || []).join('.')
    : '';
  const bleVersion =
    (knownDevice?.bleFirmwareVersion || []).join('.') ||
    usedFeatures?.bleVersion ||
    (compatibleBleVersion === '0.0.0' ? '' : compatibleBleVersion) ||
    '';

  const firmwareVersion = usedFeatures
    ? usedFeatures?.firmwareVersion ||
      (getDeviceFirmwareVersion(usedFeatures) || []).join('.') ||
      (knownDevice?.firmwareVersion || []).join('.') ||
      ''
    : '';

  return {
    bleVersion,
    firmwareVersion,
    bootloaderVersion,
  };
}

async function getDeviceVersionStr(params: IGetDeviceVersionParams) {
  const { bleVersion, firmwareVersion, bootloaderVersion } =
    await getDeviceVersion(params);
  // keep empty if version not found
  return `${bootloaderVersion}--${bleVersion}--${firmwareVersion}`;
}

function isTouchDevice(deviceType: IDeviceType) {
  return (
    [EDeviceType.Touch, EDeviceType.Pro].includes(deviceType) ||
    isProtocolV2ProductType(deviceType)
  );
}

// Keep all firmware verification capability checks centralized here.
function isFirmwareVerifySupported(_deviceType?: IDeviceType) {
  return true;
}

async function getDeviceTypeFromFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}): Promise<IDeviceType> {
  const { getDeviceType } = await CoreSDKLoader();
  return getDeviceType(features);
}

let scanner: DeviceScannerUtils | undefined;
function getDeviceScanner({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApi;
}) {
  if (!scanner) {
    scanner = new DeviceScannerUtils({ backgroundApi });
  }
  return scanner;
}

async function getDeviceModeFromFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}): Promise<EOneKeyDeviceMode> {
  // https://github.com/OneKeyHQ/hardware-js-sdk/blob/onekey/packages/core/src/device/Device.ts#L503
  // if (features?.bootloader_mode) return EOneKeyDeviceMode.bootloader;
  // if (!features?.initialized) return EOneKeyDeviceMode.initialize;
  // if (features?.no_backup) return EOneKeyDeviceMode.seedless;
  // return EOneKeyDeviceMode.normal;

  switch (features?.mode) {
    case 'bootloader':
    case 'romloader':
      return EOneKeyDeviceMode.bootloader;
    case 'notInitialized':
      return EOneKeyDeviceMode.notInitialized;
    case 'backupMode':
      return EOneKeyDeviceMode.backupMode;
    case 'normal':
      return EOneKeyDeviceMode.normal;
    default:
      break;
  }

  if (features?.bootloaderMode) return EOneKeyDeviceMode.bootloader;
  if (features?.initialized === false) return EOneKeyDeviceMode.notInitialized;
  if (features?.noBackup) return EOneKeyDeviceMode.backupMode;

  return EOneKeyDeviceMode.normal;
}

async function isBootloaderModeByFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}) {
  return (
    (await getDeviceModeFromFeatures({ features })) ===
    EOneKeyDeviceMode.bootloader
  );
}

async function existsFirmwareByFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}) {
  return features?.firmwarePresent === true;
}

async function isBootloaderModeFromSearchDevice({
  device,
}: {
  device: { mode?: string };
}) {
  return device?.mode === 'bootloader';
}

async function existsFirmwareFromSearchDevice({
  device,
}: {
  device: { features?: { firmware_present?: boolean } };
}) {
  return device?.features?.firmware_present === true;
}

function isConfirmOnDeviceAction(state: IHardwareUiState | undefined) {
  return (
    state?.action === EHardwareUiStateAction.REQUEST_PIN ||
    state?.action === EHardwareUiStateAction.REQUEST_BUTTON ||
    state?.payload?.firmwareTipData?.message ===
      EFirmwareUpdateTipMessages.ConfirmOnDevice
  );
}

/**
 * Get the connectId based on current transport type.
 *
 * Logic:
 * - Native (Mobile): Always use BLE (connectId)
 * - Desktop with BLE support:
 *   - If currentTransportType is DesktopWebBle → use BLE (connectId)
 *   - Otherwise → use USB (undefined)
 * - Other platforms: use USB (undefined)
 *
 * @param connectId
 * @param currentTransportType - Current active transport type
 * @returns undefined for USB, connectId for BLE
 */
function getUpdatingConnectId({
  connectId,
  currentTransportType,
}: {
  connectId: string | undefined;
  currentTransportType: EHardwareTransportType;
}) {
  if (platformEnv.isSupportDesktopBle) {
    if (currentTransportType === EHardwareTransportType.DesktopWebBle) {
      return connectId;
    }
    return undefined;
  }
  return platformEnv.isNative ? connectId : undefined;
}

function getFixedUpdatingConnectId({
  updatingConnectId,
  currentTransportType,
  device,
}: {
  updatingConnectId: string | undefined;
  currentTransportType: EHardwareTransportType;
  device:
    | Pick<IDBDevice, 'bleConnectId' | 'connectId' | 'usbConnectId'>
    | undefined;
}) {
  if (currentTransportType !== EHardwareTransportType.DesktopWebBle) {
    return updatingConnectId;
  }
  const bleConnectId = device?.bleConnectId?.trim();
  if (!bleConnectId) {
    return updatingConnectId;
  }
  const normalizedBleConnectId = bleConnectId.toLowerCase();
  const aliasesUsbConnectId = [device?.connectId, device?.usbConnectId].some(
    (candidate) => candidate?.trim().toLowerCase() === normalizedBleConnectId,
  );
  return aliasesUsbConnectId ? updatingConnectId : bleConnectId;
}

function checkInputPinOnSoftwareSupport(deviceType: IDeviceType) {
  return [
    EDeviceType.Classic,
    EDeviceType.Mini,
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
  ].includes(deviceType);
}

function checkAllowChangeFirmwareType(deviceType: IDeviceType) {
  return [
    EDeviceType.Pro,
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
  ].includes(deviceType);
}

// Canonical product model names (marketing names, not BLE labels). Single
// source of truth — display layers must derive from this map instead of
// keeping their own copies, which silently drift (OK-58649).
const DEVICE_MODEL_NAMES_BY_TYPE: Record<IOneKeyDeviceType, string> = {
  [EDeviceType.Classic]: 'OneKey Classic',
  [EDeviceType.Classic1s]: 'OneKey Classic 1S',
  [EDeviceType.ClassicPure]: 'OneKey Classic 1S Pure',
  [EDeviceType.Mini]: 'OneKey Mini',
  [EDeviceType.Touch]: 'OneKey Touch',
  [EDeviceType.Pro]: 'OneKey Pro',
  [EDeviceType.Pro2]: 'OneKey Pro 2',
  [NEO_DEVICE_TYPE]: 'OneKey Neo',
  [EDeviceType.Unknown]: '',
};

function getDeviceModelNameByType(deviceType: IOneKeyDeviceType): string {
  return DEVICE_MODEL_NAMES_BY_TYPE[deviceType] || '';
}

async function buildDeviceLabel({
  features,
  buildModelName,
}: {
  features: IOneKeyDeviceFeatures;
  buildModelName?: boolean;
}): Promise<string | ''> {
  const { getDeviceLabel } = await CoreSDKLoader();
  const label = getDeviceLabel(features);
  if (label && !buildModelName) {
    return label;
  }
  const deviceType = await getDeviceTypeFromFeatures({
    features,
  });
  return getDefaultDeviceLabel(deviceType);
}

async function buildDeviceName({
  device,
  features,
}: {
  device?: Omit<SearchDevice, 'commType'>;
  features: IOneKeyDeviceFeatures;
}): Promise<string> {
  const label = await buildDeviceLabel({ features });
  if (label) {
    return label;
  }
  const bleName = getDeviceBleNameFromFeatures(features);
  if (bleName) {
    return bleName;
  }
  const serialNo =
    (device as (SearchDevice & { serialNo?: string | null }) | undefined)
      ?.serialNo ||
    device?.uuid ||
    getDeviceSerialNoFromFeatures(features);
  return serialNo ? `OneKey ${serialNo.slice(-4)}` : '';
}

function buildDeviceBleName({
  features,
}: {
  features: IOneKeyDeviceFeatures | undefined;
}): string | undefined {
  if (!features) {
    return undefined;
  }
  return getDeviceBleNameFromFeatures(features);
}

/**
 * The name the DeviceStage wears on its badge and capsule second line: the
 * device's Bluetooth name in the same canonical form every other surface
 * shows it (the onboarding scan list, the device list, About) — where
 * `IDBDevice.name` is a display name the user-settable label wins (see
 * getDeviceDisplayName). Devices that advertise no Bluetooth name —
 * third-party vendors above all — keep the display name they already
 * showed.
 */
function buildDeviceStageName({
  features,
  fallbackName,
}: {
  features: IOneKeyDeviceFeatures | undefined;
  fallbackName?: string;
}): string | undefined {
  return buildDeviceBleName({ features }) || fallbackName || undefined;
}

async function getFirmwareType({
  features,
}: {
  features:
    | (IOneKeyDeviceFeatures & { $app_firmware_type?: EFirmwareType })
    | undefined;
}) {
  if (!features) {
    return EFirmwareType.Universal;
  }

  if (
    features.$app_firmware_type &&
    features.$app_firmware_type === EFirmwareType.BitcoinOnly
  ) {
    return EFirmwareType.BitcoinOnly;
  }

  const { getFirmwareType: sdkGetFirmwareType } = await CoreSDKLoader();
  return sdkGetFirmwareType(features);
}

async function getDeviceVerifyVersionsFromFeatures({
  deviceType,
  features,
}: {
  deviceType?: IDeviceType;
  features: IOneKeyDeviceFeatures;
}): Promise<IFetchFirmwareVerifyHashParams | null> {
  let finalDeviceType = deviceType;
  if (!deviceType) {
    finalDeviceType = await getDeviceTypeFromFeatures({
      features,
    });
  }
  if (!finalDeviceType || finalDeviceType === 'unknown') {
    return null;
  }

  const firmwareType = await getFirmwareType({
    features,
  });

  const onekeyFirmwareVersion = features.firmwareVersion;
  const onekeyBleVersion = features.bleVersion;
  const onekeyBootVersion = features.bootloaderVersion;
  if (!onekeyFirmwareVersion || !onekeyBleVersion || !onekeyBootVersion) {
    return null;
  }

  return {
    deviceType: finalDeviceType,
    firmwareVersion: onekeyFirmwareVersion,
    bluetoothVersion: onekeyBleVersion,
    bootloaderVersion: onekeyBootVersion,
    firmwareType,
  };
}

async function getDeviceVerifyVersionsFromRawOnekeyFeatures({
  deviceType,
  onekeyFeatures,
}: {
  deviceType: IDeviceType;
  onekeyFeatures: IRawOnekeyFeaturesForVerify;
}): Promise<IFetchFirmwareVerifyHashParams | null> {
  const firmwareVersion = onekeyFeatures.onekey_firmware_version;
  const bluetoothVersion = onekeyFeatures.onekey_ble_version;
  const bootloaderVersion = onekeyFeatures.onekey_boot_version;

  if (!firmwareVersion || !bluetoothVersion || !bootloaderVersion) {
    return null;
  }

  return {
    deviceType,
    firmwareVersion,
    bluetoothVersion,
    bootloaderVersion,
    firmwareType:
      onekeyFeatures.fw_vendor === 'OneKey Bitcoin-only'
        ? EFirmwareType.BitcoinOnly
        : EFirmwareType.Universal,
  };
}

function formatVersionWithHash(
  rawVersion: IDeviceVerifyRawVersions,
): IDeviceVerifyVersions {
  const { version, checksum, commitId, releaseUrl } = rawVersion;

  if (!version) {
    return {
      raw: { version, checksum, commitId },
      formatted: '',
    };
  }

  if (!checksum || !commitId) {
    return {
      raw: { version, checksum, commitId },
      formatted: '-',
    };
  }

  let validatedReleaseUrl: string | undefined;

  try {
    if (releaseUrl) {
      // eslint-disable-next-line no-new
      new URL(releaseUrl);
      validatedReleaseUrl = releaseUrl;
    }
  } catch {
    // ignore
  }

  return {
    raw: { version, checksum, commitId },
    releaseUrl: validatedReleaseUrl,
    formatted: `${version} (${commitId}-${checksum.slice(0, 7)})`,
  };
}

export function parseLocalDeviceVersions({
  onekeyFeatures,
}: {
  onekeyFeatures: OnekeyFeatures;
}): IAllDeviceVerifyVersions {
  return {
    firmware: formatVersionWithHash({
      version: onekeyFeatures.onekey_firmware_version,
      checksum: onekeyFeatures.onekey_firmware_hash,
      commitId: onekeyFeatures.onekey_firmware_build_id,
    }),
    bluetooth: formatVersionWithHash({
      version: onekeyFeatures.onekey_ble_version,
      checksum: onekeyFeatures.onekey_ble_hash,
      commitId: onekeyFeatures.onekey_ble_build_id,
    }),
    bootloader: formatVersionWithHash({
      version: onekeyFeatures.onekey_boot_version,
      checksum: onekeyFeatures.onekey_boot_hash,
      commitId: onekeyFeatures.onekey_boot_build_id,
    }),
  };
}

export function parseServerVersionInfos({
  serverVerifyInfos,
}: {
  serverVerifyInfos: IFirmwareVerifyInfo[];
}): IAllDeviceVerifyVersions {
  const defaultVersion: IDeviceVerifyVersions = {
    raw: { version: '', checksum: '', commitId: '' },
    formatted: '',
  };

  const result: IAllDeviceVerifyVersions = {
    firmware: defaultVersion,
    bluetooth: defaultVersion,
    bootloader: defaultVersion,
  };

  // loop through server verify infos
  serverVerifyInfos.forEach((item) => {
    switch (item.type) {
      case EFirmwareVerifyType.System:
        result.firmware = formatVersionWithHash(item);
        break;
      case EFirmwareVerifyType.Bluetooth:
        result.bluetooth = formatVersionWithHash(item);
        break;
      case EFirmwareVerifyType.Bootloader:
        result.bootloader = formatVersionWithHash(item);
        break;
      default:
        break;
    }
  });

  return result;
}

export function compareDeviceVersions({
  local,
  remote,
}: {
  local: IDeviceVerifyRawVersions;
  remote: IDeviceVerifyRawVersions;
}): boolean {
  return (
    local.version === remote.version &&
    local.checksum === remote.checksum &&
    local.commitId === remote.commitId
  );
}

async function shouldUseV2FirmwareUpdateFlow({
  features,
}: {
  features: IOneKeyDeviceFeatures | undefined;
}) {
  if (!features) {
    return false;
  }

  const { getDeviceBootloaderVersion, getDeviceType } = await CoreSDKLoader();
  const deviceType = getDeviceType(features);
  if (isProtocolV2ProductType(deviceType)) {
    return true;
  }
  if (deviceType !== EDeviceType.Pro) {
    return false;
  }
  const bootloaderVersion = getDeviceBootloaderVersion(features)?.join('.');
  return !!(
    semver.valid(bootloaderVersion) &&
    // TODO: use constant
    semver.gte(bootloaderVersion, '2.8.0')
  );
}

function getRawDeviceId({
  device,
  features,
  deviceState,
  isThirdParty,
}: {
  device: Omit<SearchDevice, 'commType'>;
  features?: IOneKeyDeviceFeatures;
  deviceState?: Pick<DeviceState, 'identity'>;
  isThirdParty?: boolean;
}) {
  const knownDevice = device as KnownDevice | undefined;
  const usedFeatures = features || knownDevice?.features;
  return isThirdParty
    ? usedFeatures?.device_id || usedFeatures?.deviceId || device.deviceId || ''
    : deviceState?.identity.deviceId ||
        device.deviceId ||
        usedFeatures?.deviceId ||
        '';
}

function isBluetoothSearchDevice(device: {
  commType?: SearchDevice['commType'] | null;
}): boolean {
  return (
    device.commType === 'ble' ||
    device.commType === 'webble' ||
    device.commType === 'electron-ble'
  );
}

/**
 * Get the appropriate connectId based on transport type
 * @param device - The device object
 * @param transportType - The transport type (USB, BLE, etc.)
 * @returns The appropriate connectId for the transport type
 */
function getDeviceConnectId(
  device: IDBDevice,
  transportType: EHardwareTransportType,
): string {
  switch (transportType) {
    case EHardwareTransportType.WEBUSB:
    case EHardwareTransportType.Bridge:
      return device.usbConnectId || device.connectId;

    case EHardwareTransportType.BLE:
    case EHardwareTransportType.DesktopWebBle:
      return device.bleConnectId || device.connectId;

    default:
      return device.connectId;
  }
}

function getDesktopUsbTransportType({
  usbCommunicationMode,
  connectProtocol,
}: {
  usbCommunicationMode?: 'webusb' | 'bridge';
  connectProtocol?: HardwareConnectProtocol;
}): EHardwareTransportType {
  if (
    connectProtocol === 'V2' ||
    platformEnv.isDesktopLinux ||
    usbCommunicationMode !== 'bridge'
  ) {
    return EHardwareTransportType.WEBUSB;
  }
  return EHardwareTransportType.Bridge;
}

function normalizeHardwareTransportTypeForPlatform({
  transportType,
  connectProtocol,
}: {
  transportType: EHardwareTransportType;
  connectProtocol?: HardwareConnectProtocol;
}): EHardwareTransportType {
  if (transportType === EHardwareTransportType.Bridge) {
    return getDesktopUsbTransportType({
      usbCommunicationMode: 'bridge',
      connectProtocol,
    });
  }
  return transportType;
}

function getDefaultHardwareTransportType(): EHardwareTransportType {
  if (platformEnv.isNative) {
    return EHardwareTransportType.BLE;
  }
  if (platformEnv.isSupportWebUSB) {
    return EHardwareTransportType.WEBUSB;
  }
  return normalizeHardwareTransportTypeForPlatform({
    transportType: EHardwareTransportType.Bridge,
  });
}

function getFirmwareTypeByCachedFeatures({
  features,
}: {
  features:
    | (IOneKeyDeviceFeatures & { $app_firmware_type?: EFirmwareType })
    | undefined;
}) {
  if (!features) {
    return EFirmwareType.Universal;
  }

  return features.$app_firmware_type;
}

function getFirmwareTypeLabelByFirmwareType({
  firmwareType,
  returnUniversal,
  displayFormat,
}: {
  firmwareType: EFirmwareType | undefined;
  returnUniversal?: boolean;
  displayFormat?: 'withSpace' | 'withoutSpace';
}) {
  const space = displayFormat === 'withSpace' ? ' ' : '';

  if (!firmwareType) {
    if (returnUniversal) {
      return `Universal${space}`;
    }
    return '';
  }

  if (firmwareType === EFirmwareType.BitcoinOnly) {
    return `Bitcoin-Only${space}`;
  }

  if (!!returnUniversal && firmwareType === EFirmwareType.Universal) {
    return `Universal${space}`;
  }
  return '';
}

async function getFirmwareTypeLabel({
  features,
  returnUniversal,
  displayFormat,
}: {
  features: IOneKeyDeviceFeatures | undefined;
  returnUniversal?: boolean;
  displayFormat?: 'withSpace' | 'withoutSpace';
}) {
  if (!features) {
    return getFirmwareTypeLabelByFirmwareType({
      firmwareType: undefined,
      returnUniversal,
      displayFormat,
    });
  }

  const { getFirmwareType: sdkGetFirmwareType } = await CoreSDKLoader();
  const firmwareType = sdkGetFirmwareType(features);
  return getFirmwareTypeLabelByFirmwareType({
    firmwareType,
    returnUniversal,
    displayFormat,
  });
}

async function isBtcOnlyFirmware({
  features,
}: {
  features: IOneKeyDeviceFeatures | undefined;
}) {
  if (!features) {
    return false;
  }
  const firmwareType = await getFirmwareType({ features });
  return firmwareType === EFirmwareType.BitcoinOnly;
}

async function buildDeviceUSBConnectId({
  features,
}: {
  features: Features | undefined;
}): Promise<string | null> {
  if (!features) {
    return null;
  }
  return getDeviceSerialNoFromFeatures(features) || null;
}

async function attachAppParamsToFeatures({
  features,
}: {
  features: IOneKeyDeviceFeatures;
}): Promise<IOneKeyDeviceFeaturesWithAppParams> {
  const firmwareType = await getFirmwareType({
    features,
  });
  return { ...features, $app_firmware_type: firmwareType };
}

async function getLanguageConfig({ deviceType }: { deviceType: IDeviceType }) {
  const { getLanguageConfig: sdkGetLanguageConfig } = await CoreSDKLoader();
  return sdkGetLanguageConfig(deviceType);
}

function resolveDeviceLanguageCode({
  language,
  supportedCodes,
}: {
  language: string | undefined;
  supportedCodes: string[];
}) {
  if (!language) {
    return undefined;
  }

  const normalize = (value: string) =>
    value.trim().replaceAll('_', '-').toLowerCase();
  const normalizedLanguage = normalize(language);
  const exactMatch = supportedCodes.find(
    (code) => normalize(code) === normalizedLanguage,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const parse = (value: string) => {
    const [languageCode = '', ...languageParts] = normalize(value).split('-');
    return {
      languageCode,
      script: languageParts.find((part) => part.length === 4),
      region: languageParts.find(
        (part) => part.length === 2 || /^\d{3}$/.test(part),
      ),
    };
  };
  const target = parse(language);
  let bestMatch: { code: string; score: number } | undefined;

  for (const code of supportedCodes) {
    const candidate = parse(code);
    if (candidate.languageCode === target.languageCode) {
      let score = 1;
      if (candidate.region && target.region) {
        score += candidate.region === target.region ? 8 : -4;
      }
      if (candidate.script && target.script) {
        score += candidate.script === target.script ? 4 : -2;
      }
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { code, score };
      }
    }
  }

  return bestMatch?.code;
}

async function getAutoLockOptions({
  deviceType,
  protocol,
}: {
  deviceType: IDeviceType;
  protocol: DeviceSettingsProtocol;
}) {
  const {
    getAutoLockOptions: sdkGetAutoLockOptions,
    PROTOCOL_V2_NEVER_TIMEOUT_MS,
  } = await CoreSDKLoader();
  return sdkGetAutoLockOptions(deviceType, protocol).map((option) => ({
    ...option,
    isNever:
      option.valueMs === 0 || option.valueMs === PROTOCOL_V2_NEVER_TIMEOUT_MS,
  }));
}

async function getAutoShutDownOptions({
  deviceType,
  protocol,
}: {
  deviceType: IDeviceType;
  protocol: DeviceSettingsProtocol;
}) {
  const {
    getAutoShutDownOptions: sdkGetAutoShutDownOptions,
    PROTOCOL_V2_NEVER_TIMEOUT_MS,
  } = await CoreSDKLoader();
  return sdkGetAutoShutDownOptions(deviceType, protocol).map((option) => ({
    ...option,
    isNever:
      option.valueMs === 0 || option.valueMs === PROTOCOL_V2_NEVER_TIMEOUT_MS,
  }));
}

export enum ESupportSettings {
  HapticFeedback = 'hapticFeedback',
  Brightness = 'brightness',
  AutoLock = 'autoLock',
  AutoShutDown = 'autoShutDown',
  Language = 'language',
}

function supportSettings({
  deviceType,
  firmwareVersion,
  setting,
}: {
  deviceType: IDeviceType;
  firmwareVersion: string;
  setting: ESupportSettings;
}) {
  if (isProtocolV2ProductType(deviceType)) {
    return true;
  }

  if (setting === ESupportSettings.AutoLock) {
    if ([EDeviceType.Pro].includes(deviceType)) {
      return true;
    }
    return false;
  }

  // default
  const support = firmwareVersion && semver.gte(firmwareVersion, '4.19.0');
  if (support && [EDeviceType.Pro].includes(deviceType)) {
    return true;
  }
  return false;
}

export default {
  isSamePhysicalDevice,
  getDeviceDisplayName,
  getDeviceVersionsFromState,
  dbDeviceToSearchDevice,
  getDeviceVersion,
  getDeviceSerialNoFromFeatures,
  getDeviceVersionStr,
  getDeviceTypeFromFeatures,
  getDeviceModeFromFeatures,
  isBootloaderModeByFeatures,
  isBootloaderModeFromSearchDevice,
  existsFirmwareByFeatures,
  existsFirmwareFromSearchDevice,
  getDeviceScanner,
  getUpdatingConnectId,
  getFixedUpdatingConnectId,
  isConfirmOnDeviceAction,
  getDeviceModelNameByType,
  buildDeviceLabel,
  buildDeviceName,
  buildDeviceBleName,
  buildDeviceStageName,
  getDefaultDeviceLabel,
  getDeviceVerifyVersionsFromFeatures,
  getDeviceVerifyVersionsFromRawOnekeyFeatures,
  formatVersionWithHash,
  parseLocalDeviceVersions,
  parseServerVersionInfos,
  compareDeviceVersions,
  shouldUseV2FirmwareUpdateFlow,
  getRawDeviceId,
  isBluetoothSearchDevice,
  getDeviceConnectId,
  getDesktopUsbTransportType,
  normalizeHardwareTransportTypeForPlatform,
  getDefaultHardwareTransportType,
  isBtcOnlyFirmware,
  getFirmwareTypeByCachedFeatures,
  getFirmwareType,
  getFirmwareTypeLabel,
  getFirmwareTypeLabelByFirmwareType,
  isTouchDevice,
  isFirmwareVerifySupported,
  buildDeviceUSBConnectId,
  attachAppParamsToFeatures,
  checkInputPinOnSoftwareSupport,
  checkAllowChangeFirmwareType,
  getLanguageConfig,
  resolveDeviceLanguageCode,
  getAutoLockOptions,
  getAutoShutDownOptions,
  ESupportSettings,
  supportSettings,
};
