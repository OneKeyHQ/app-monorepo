import { ELegacyFirmwareUpdateSteps } from '../../../states/jotai/atoms/legacyFirmwareUpdate';
import {
  preCheckAndUpdateBootloader,
  waitForDeviceRestart,
} from '../utils/bootloaderPreCheck';

import type { ILegacyUpdateParams, ILegacyUpdateResult } from '../types';
import type ServiceLegacyFirmwareUpdate from '../ServiceLegacyFirmwareUpdate';

const DEVICE_RESTART_WAIT_MS = 15_000;

export class MiniFirmwareHandler {
  /**
   * Mini device upgrade flow
   *
   * Mini devices require:
   * 1. Manual bootloader mode entry (user must hold button + insert USB)
   * 2. Bootloader pre-check and update if needed
   * 3. Firmware update
   */
  async update(
    params: ILegacyUpdateParams,
    service: ServiceLegacyFirmwareUpdate,
  ): Promise<ILegacyUpdateResult> {
    const { connectId, isBootloaderMode, targetFirmwareVersion, deviceType } =
      params;

    // 1. Check if device is in bootloader mode
    if (!isBootloaderMode) {
      await service.setStep(ELegacyFirmwareUpdateSteps.waitingBootloaderMode, {
        deviceType: deviceType,
      });
      // UI will show guidance for user to enter bootloader mode
      // User action required, then flow restarts
      return {
        success: false,
        needsBootloaderMode: true,
        deviceType,
      };
    }

    // 2. Bootloader pre-check and update
    await service.setStep(ELegacyFirmwareUpdateSteps.checkingBootloader);
    await service.setProgress(10, 'Checking bootloader...');

    const sdk = await service.getSDKInstance(connectId);

    if (targetFirmwareVersion) {
      const bootloaderResult = await preCheckAndUpdateBootloader({
        sdk,
        connectId,
        targetFirmwareVersion,
        deviceType,
      });

      if (bootloaderResult.needsUpdate) {
        await service.setStep(ELegacyFirmwareUpdateSteps.updatingBootloader);
        await service.setProgress(20, 'Updating bootloader...');

        if (!bootloaderResult.updateSuccess) {
          throw new Error('Bootloader update failed');
        }

        // WebUSB: Need to reselect device after bootloader update (PID changes)
        await service.setStep(ELegacyFirmwareUpdateSteps.requestDeviceReselect);

        // Wait for device restart
        await service.setProgress(30, 'Waiting for device restart...');
        await waitForDeviceRestart(DEVICE_RESTART_WAIT_MS);
      }
    }

    // 3. Execute firmware update
    await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
      phase: 'firmware',
    });
    await service.setProgress(50, 'Installing firmware...');

    const result = await sdk.firmwareUpdateV2(connectId, {
      updateType: 'firmware',
      platform: 'web',
    });

    if (!result.success) {
      throw new Error(result.payload?.error || 'Firmware update failed');
    }

    await service.setProgress(100, 'Upgrade complete');

    return {
      success: true,
      deviceType,
    };
  }
}
