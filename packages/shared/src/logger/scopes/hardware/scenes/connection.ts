import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

export type IHardwareAvailabilityContext = {
  attemptId: string;
  operation: 'connect' | 'search';
  transport: 'ble' | 'unknown' | 'usb';
  vendor: EHardwareVendor | 'unknown';
};

export class HardwareConnectionScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public hardwareOperationAttempt(params: IHardwareAvailabilityContext) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public hardwareOperationResult(
    params: IHardwareAvailabilityContext & {
      deviceCount: number;
      durationMs: number;
      errorCode: string;
      status: 'cancelled' | 'failed' | 'success' | 'timeout';
    },
  ) {
    return params;
  }

  @LogToServer()
  public hwDeviceConnected(params: {
    deviceType: IDeviceType;
    firmwareType: 'btconly' | 'universal';
    deviceId: string;
  }) {
    const { deviceType, firmwareType } = params;
    // Device identifiers are intentionally excluded from server analytics.
    return { deviceType, firmwareType };
  }
}
