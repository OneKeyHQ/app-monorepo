import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type {
  IDeviceStageConnectionTypeValue,
  IDeviceStageExitViaValue,
  IDeviceStageStepValue,
} from '@onekeyhq/shared/types/deviceStage';

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

  /**
   * The person left the DeviceStage themselves (design hard rule #3):
   * which step they left, by which route, and how long they had been
   * waiting — the numbers the exit policy's thresholds are tuned on.
   */
  @LogToServer()
  public deviceStageClosed(params: {
    step: IDeviceStageStepValue;
    via: IDeviceStageExitViaValue;
    transport: IDeviceStageConnectionTypeValue;
    vendor?: EHardwareVendor;
    /** Since the stage appeared for this burst. */
    sinceAppearanceMs: number;
    /** Since the current machine wait began; absent off a wait. */
    sinceWaitMs?: number;
    /** The wait had run past the stall threshold when they left. */
    stalled: boolean;
    /** The wait followed something they answered on a card. */
    afterAnswer: boolean;
  }) {
    return params;
  }

  /**
   * One machine wait on the DeviceStage (a stretch on one wait step)
   * ended: how long it ran and whether it crossed the stall threshold.
   */
  @LogToServer()
  public deviceStageWaitEnded(params: {
    step: IDeviceStageStepValue;
    transport: IDeviceStageConnectionTypeValue;
    vendor?: EHardwareVendor;
    durationMs: number;
    stalled: boolean;
    afterAnswer: boolean;
    endedBy: 'next' | 'off';
  }) {
    return params;
  }
}
