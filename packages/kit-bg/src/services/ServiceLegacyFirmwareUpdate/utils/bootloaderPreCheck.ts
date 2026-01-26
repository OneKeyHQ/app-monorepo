import { EDeviceType } from '@onekeyfe/hd-shared';

import type { IDeviceType } from '@onekeyfe/hd-core';

export interface IBootloaderPreCheckParams {
  sdk: any;
  connectId: string | undefined;
  targetFirmwareVersion: string;
  deviceType: IDeviceType | string;
}

export interface IBootloaderPreCheckResult {
  needsUpdate: boolean;
  updateSuccess: boolean;
}

/**
 * Device types that require bootloader pre-check before firmware update
 */
const NEEDS_PRECHECK_DEVICES = new Set<IDeviceType | string>([
  EDeviceType.Classic,
  EDeviceType.Classic1s,
  EDeviceType.ClassicPure,
  EDeviceType.Mini,
]);

/**
 * Pre-check and update bootloader before firmware update
 * Classic/Mini devices may need bootloader update before firmware can be updated
 */
export async function preCheckAndUpdateBootloader(
  params: IBootloaderPreCheckParams,
): Promise<IBootloaderPreCheckResult> {
  const { sdk, connectId, targetFirmwareVersion, deviceType } = params;

  // Check if device needs pre-check
  if (!NEEDS_PRECHECK_DEVICES.has(deviceType as IDeviceType)) {
    return { needsUpdate: false, updateSuccess: true };
  }

  // Call SDK to check bootloader release
  const checkResult = await sdk.checkBootloaderRelease(connectId, {
    willUpdateFirmwareVersion: targetFirmwareVersion,
  });

  if (!checkResult.success || !checkResult.payload?.shouldUpdate) {
    return { needsUpdate: false, updateSuccess: true };
  }

  // Needs bootloader update
  const updateResult = await sdk.firmwareUpdateV2(connectId, {
    updateType: 'firmware',
    platform: 'web',
    isUpdateBootloader: true,
  });

  return {
    needsUpdate: true,
    updateSuccess: updateResult.success,
  };
}

/**
 * Wait for device to restart after bootloader update
 */
export function waitForDeviceRestart(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
