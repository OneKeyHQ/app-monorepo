import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { ELegacyFirmwareUpdateSteps } from '../../../states/jotai/atoms/legacyFirmwareUpdate';

import type { ILegacyUpdateParams, ILegacyUpdateResult } from '../types';
import type ServiceLegacyFirmwareUpdate from '../ServiceLegacyFirmwareUpdate';

export class MiniFirmwareHandler {
  /**
   * Mini device upgrade flow
   *
   * Mini devices require manual bootloader mode entry:
   * 1. User must hold button + insert USB to enter bootloader
   * 2. SDK will throw FirmwareUpdateManuallyEnterBoot error if not in bootloader mode
   * 3. We catch this error and show guidance UI
   * 4. User enters bootloader mode, device reconnects
   * 5. Update is restarted (user clicks "Start Update" again)
   *
   * Note: Mini cannot use RebootToBootloader command - it will brick the device!
   * SDK handles bootloader pre-check and update internally via firmwareUpdateV2.
   */
  async update(
    params: ILegacyUpdateParams,
    service: ServiceLegacyFirmwareUpdate,
  ): Promise<ILegacyUpdateResult> {
    const { connectId, targetFirmwareVersion, deviceType } = params;

    // 1. Set downloading state
    await service.setStep(ELegacyFirmwareUpdateSteps.downloadingFirmware, {
      firmwareField: 'firmware',
    });
    await service.setProgress(20, 'Preparing firmware update...');

    const sdk = await service.getSDKInstance(connectId);

    // 2. Execute firmware update
    // SDK will:
    // - Check if device needs to enter bootloader mode manually (Mini always does)
    // - Throw FirmwareUpdateManuallyEnterBoot error if not in bootloader mode
    // - Handle bootloader pre-check and update if needed
    // - Download and install firmware
    await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
      phase: 'firmware',
    });
    await service.setProgress(50, 'Installing firmware...');

    // Convert version string to array format (e.g., "3.5.0" -> [3, 5, 0])
    const versionArr = targetFirmwareVersion
      ?.split('.')
      .map((v) => parseInt(v, 10));

    try {
      const result = await sdk.firmwareUpdateV2(connectId, {
        updateType: 'firmware',
        platform: 'web',
        ...(versionArr ? { version: versionArr } : {}),
      });

      if (!result.success) {
        // Check if SDK indicates manual bootloader mode is needed
        if (
          result.payload?.code ===
          HardwareErrorCode.FirmwareUpdateManuallyEnterBoot
        ) {
          await service.setStep(
            ELegacyFirmwareUpdateSteps.waitingBootloaderMode,
            {
              deviceType,
            },
          );
          return {
            success: false,
            needsBootloaderMode: true,
            deviceType,
          };
        }
        throw new Error(result.payload?.error || 'Firmware update failed');
      }
    } catch (error: any) {
      // SDK throws FirmwareUpdateManuallyEnterBoot error when Mini is not in bootloader mode
      if (
        error?.errorCode ===
          HardwareErrorCode.FirmwareUpdateManuallyEnterBoot ||
        error?.code === HardwareErrorCode.FirmwareUpdateManuallyEnterBoot
      ) {
        await service.setStep(
          ELegacyFirmwareUpdateSteps.waitingBootloaderMode,
          {
            deviceType,
          },
        );
        return {
          success: false,
          needsBootloaderMode: true,
          deviceType,
        };
      }
      throw error;
    }

    await service.setProgress(100, 'Upgrade complete');

    return {
      success: true,
      deviceType,
    };
  }
}
