import { ELegacyFirmwareUpdateSteps } from '../../../states/jotai/atoms/legacyFirmwareUpdate';
import {
  preCheckAndUpdateBootloader,
  waitForDeviceRestart,
} from '../utils/bootloaderPreCheck';

import type { ILegacyUpdateParams, ILegacyUpdateResult } from '../types';
import type ServiceLegacyFirmwareUpdate from '../ServiceLegacyFirmwareUpdate';

const DEVICE_RESTART_WAIT_MS = 15_000;

export class ClassicFirmwareHandler {
  /**
   * Classic series device upgrade flow
   * Applicable to: Classic, Classic1s, ClassicPure
   *
   * Classic devices require:
   * 1. Bootloader pre-check and update if needed
   * 2. Firmware update
   * 3. Optional BLE update
   */
  async update(
    params: ILegacyUpdateParams,
    service: ServiceLegacyFirmwareUpdate,
  ): Promise<ILegacyUpdateResult> {
    const { connectId, targetFirmwareVersion, deviceType, shouldUpdateBle } =
      params;
    const sdk = await service.getSDKInstance(connectId);

    // 1. Bootloader pre-check and update
    await service.setStep(ELegacyFirmwareUpdateSteps.checkingBootloader);
    await service.setProgress(10, 'Checking bootloader...');

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
        await service.setProgress(40, 'Waiting for device restart...');
        await waitForDeviceRestart(DEVICE_RESTART_WAIT_MS);
      }
    }

    // 2. Execute firmware update
    await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
      phase: 'firmware',
    });
    await service.setProgress(50, 'Installing firmware...');

    const firmwareResult = await sdk.firmwareUpdateV2(connectId, {
      updateType: 'firmware',
      platform: 'web',
    });

    if (!firmwareResult.success) {
      throw new Error(
        firmwareResult.payload?.error || 'Firmware update failed',
      );
    }

    // 3. Optional BLE update
    if (shouldUpdateBle) {
      await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
        phase: 'ble',
      });
      await service.setProgress(80, 'Updating Bluetooth firmware...');

      const bleResult = await sdk.firmwareUpdateV2(connectId, {
        updateType: 'ble',
        platform: 'web',
      });

      if (!bleResult.success) {
        // BLE failure doesn't block main flow, just log warning
        console.warn('BLE update failed:', bleResult.payload?.error);
      }
    }

    await service.setProgress(100, 'Upgrade complete');

    return {
      success: true,
      deviceType,
    };
  }
}
