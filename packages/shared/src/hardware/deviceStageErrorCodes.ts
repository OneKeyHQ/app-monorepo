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
