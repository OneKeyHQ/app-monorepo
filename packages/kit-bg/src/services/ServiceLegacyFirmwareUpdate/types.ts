import type { IDeviceType } from '@onekeyfe/hd-core';

/**
 * Parameters for checking if legacy flow should be used
 */
export interface ILegacyFlowCheckParams {
  deviceType: IDeviceType | string;
  firmwareVersion: string;
  bootloaderVersion: string;
}

/**
 * Legacy update parameters
 */
export interface ILegacyUpdateParams {
  deviceType: IDeviceType | string;
  connectId: string | undefined;
  currentFirmwareVersion: string;
  currentBootloaderVersion: string;
  targetFirmwareVersion?: string;
  isBootloaderMode?: boolean;
  shouldUpdateBle?: boolean;
}

/**
 * Legacy update result
 */
export interface ILegacyUpdateResult {
  success: boolean;
  deviceType: IDeviceType | string;
  needsBootloaderMode?: boolean;
  error?: string;
}
