import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { IDeviceStageStepValue } from '@onekeyhq/shared/types/deviceStage';

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
    via: 'close' | 'escape' | 'back';
    transport: 'bluetooth' | 'usb';
    vendor?: string;
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
   * One continuous machine wait on the DeviceStage ended: how long it
   * ran and whether it crossed the stall threshold first.
   */
  @LogToServer()
  public deviceStageWaitEnded(params: {
    step: IDeviceStageStepValue;
    transport: 'bluetooth' | 'usb';
    vendor?: string;
    durationMs: number;
    stalled: boolean;
    afterAnswer: boolean;
    endedBy: 'next' | 'off';
  }) {
    return params;
  }
}
