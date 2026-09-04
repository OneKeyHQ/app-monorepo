import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

import type { IDeviceType } from '@onekeyfe/hd-core';

export class HardwareConnectionScene extends BaseScene {
  @LogToServer()
  public hwDeviceConnected(params: {
    deviceType: IDeviceType;
    firmwareType: 'btconly' | 'universal';
    deviceId: string;
  }) {
    return params;
  }

  @LogToServer()
  public portfolioSynced(params: {
    deviceId: string;
    deviceType: IDeviceType;
  }) {
    return params;
  }

  @LogToServer()
  public portfolioSyncResult(params: {
    deviceId: string;
    deviceType: IDeviceType;
    transportType?: EHardwareTransportType;
    syncMode: 'interactive' | 'silent';
    status: 'success' | 'failed';
    failureStage?: 'unlock' | 'prepare' | 'pack' | 'device-sync';
    errorCode?: string;
    syncDurationMs: number;
    packDurationMs?: number;
    hardwareDurationMs?: number;
    portfolioJsonBytes?: number;
    packageBytes?: number;
    effectiveTransferRateBytesPerSecond?: number;
    tokenCount?: number;
    totalTokenCount?: number;
  }) {
    return params;
  }
}
