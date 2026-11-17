import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type {
  IDeviceStageConnectionTypeValue,
  IDeviceStageExitViaValue,
  IDeviceStageStepValue,
} from '@onekeyhq/shared/types/deviceStage';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IDeviceType, KnownDevice } from '@onekeyfe/hd-core';

export type IBleCommunicationTelemetry = {
  deviceType?: string;
  firmwareVersion?: string;
  bleVersion?: string;
  transportType: 'ble';
  platform: 'ios' | 'android' | 'desktop';
  method: 'FilesystemFileWrite';
  status: 'success' | 'failed';
  mode: 'native-frame' | 'per-packet';
  // Success summaries combine calls over a ten-second window; older events
  // without this field represent one FileWrite call.
  callCount?: number;
  frames: number;
  packets: number;
  bytes: number;
  durationMs: number;
  effectiveTransferRateBytesPerSecond?: number;
  writeDurationMs?: number;
  readWaitDurationMs?: number;
};

export class HardwareConnectionScene extends BaseScene {
  @LogToServer({ level: 'info', waitForServer: true })
  private bleCommunicationResult(params: IBleCommunicationTelemetry) {
    return params;
  }

  public reportBleCommunicationResult(
    params: IBleCommunicationTelemetry,
  ): Promise<void> {
    return this.bleCommunicationResult(params) as unknown as Promise<void>;
  }

  @LogToLocal({ level: 'info' })
  public bleCommunicationRecorded(params: IBleCommunicationTelemetry) {
    return params;
  }

  @LogToServer()
  public bleMtuReady(params: {
    transportType: 'ble';
    blePlatform: 'ios' | 'android';
    requestedMtu: number;
    actualMtu?: number;
    isDefaultMtu?: boolean;
  }) {
    return params;
  }

  @LogToServer()
  public hwDeviceConnected(params: {
    deviceType: IDeviceType;
    firmwareType: 'btconly' | 'universal';
    deviceId: string;
    serialNo?: string;
    firmwareVersion?: string;
    transportType?: NonNullable<KnownDevice['commType']>;
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
    schemaVersion?: 1 | 2;
    firmwareVersion?: string;
    deFiSource?: 'live' | 'cache' | 'empty' | 'unknown';
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
