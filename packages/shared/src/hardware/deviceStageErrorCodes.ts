import { HardwareErrorCode } from '@onekeyfe/hd-shared';

/**
 * The transport-death codes: the device stopped answering mid-call.
 * DeviceNotFound (105) is deliberately absent — the initial search
 * failing is its own verdict (the "Device not connected" card's territory),
 * and the stage burst classifies it apart by whether it ever heard from
 * the device. Shared by the stage burst's error mapping and the
 * authenticity flow's failure classifier so "disconnected" means the same
 * thing on both sides.
 */
export const DEVICE_STAGE_DISCONNECTED_CODES = [
  HardwareErrorCode.PollingTimeout,
  HardwareErrorCode.BridgeDeviceDisconnected,
  HardwareErrorCode.BleDeviceDisconnected,
  HardwareErrorCode.BleScanError,
  HardwareErrorCode.BleTimeoutError,
];

/**
 * The failures a dedicated dialog already speaks for: the BLE re-pairing
 * guidance, the enable-passphrase prompt, the forced-update prompt, and
 * the "Enable Bluetooth" family the SDK (and the Android pre-check) raise
 * for Bluetooth off / no BLE permission / location services off — the
 * stage stands down for these instead of landing a second notice under
 * the sheet (OK-62113). Shared by the stage burst, which yields the stage,
 * and the authenticity flow, which ends its run without a failure card, so
 * "a dialog owns this" means the same thing on both sides.
 */
export const DEVICE_STAGE_DEDICATED_DIALOG_CODES = [
  HardwareErrorCode.BleDeviceBondError,
  HardwareErrorCode.BlePeerRemovedPairingInformation,
  HardwareErrorCode.BleBondInvalid,
  HardwareErrorCode.DeviceNotOpenedPassphrase,
  HardwareErrorCode.NewFirmwareForceUpdate,
  HardwareErrorCode.BlePermissionError,
  HardwareErrorCode.BleLocationError,
  HardwareErrorCode.BleLocationServicesDisabled,
];
