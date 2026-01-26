import { ELegacyFirmwareUpdateSteps } from '../../../states/jotai/atoms/legacyFirmwareUpdate';

import type { ILegacyUpdateParams, ILegacyUpdateResult } from '../types';
import type ServiceLegacyFirmwareUpdate from '../ServiceLegacyFirmwareUpdate';

export class TouchFirmwareHandler {
  /**
   * Touch device upgrade flow
   *
   * Touch devices < 4.1.0 use the SDK's firmwareUpdateV2 directly.
   * The SDK handles firmware download and installation internally.
   */
  async update(
    params: ILegacyUpdateParams,
    service: ServiceLegacyFirmwareUpdate,
  ): Promise<ILegacyUpdateResult> {
    const { connectId, deviceType } = params;

    // 1. Set downloading state
    await service.setStep(ELegacyFirmwareUpdateSteps.downloadingFirmware, {
      firmwareField: 'firmware',
    });
    await service.setProgress(20, 'Preparing firmware update...');

    const sdk = await service.getSDKInstance(connectId);

    // 2. Execute firmware update
    // The SDK will download and install the firmware
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
