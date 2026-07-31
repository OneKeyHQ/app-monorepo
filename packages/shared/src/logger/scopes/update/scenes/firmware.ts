import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IFirmwareVersions } from './firmwareVersions';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

export { parseFirmwareVersions } from './firmwareVersions';

export class FirmwareScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public firmwareArtifactSelfTest(params: {
    runId: string;
    runtime: 'bg';
    platform: 'ios' | 'android' | 'desktop';
    scenario: 'pro-firmware' | 'pro-resource' | 'pro-full-resource';
    phase:
      | 'starting'
      | 'preflight'
      | 'reading'
      | 'sdk-handoff'
      | 'device-boundary'
      | 'cache-stress'
      | 'failure-cleanup'
      | 'sweeping'
      | 'completed'
      | 'failed'
      | 'cancelled';
    outcome: 'started' | 'progress' | 'success' | 'failure' | 'cancelled';
    durationMs: number;
    bytes?: number;
    chunkCount?: number;
    materializedEntryCount?: number;
    preflightCompletedIterations?: number;
    preparedPlanValidated?: boolean;
    sdkHandoffValidated?: boolean;
    cleanupValidated?: boolean;
    failureCleanupValidated?: boolean;
    sdkBoundaryCode?: string;
    errorCode?: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public firmwareUpdateStarted(params: {
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v1' | 'v2';
    firmwareVersions: IFirmwareVersions;
  }) {
    return params;
  }

  @LogToServer()
  public firmwareSwitchStart(params: {
    deviceType: IDeviceType | undefined;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
  }) {
    return params;
  }

  @LogToServer()
  public firmwareSwitchSuccess(params: {
    deviceType: IDeviceType | undefined;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
  }) {
    return params;
  }

  /** Track every update-task attempt so success and failure rates share one denominator. */
  @LogToServer()
  @LogToLocal()
  public firmwareUpdateAttemptResult(params: {
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v1' | 'v2';
    firmwareVersions: IFirmwareVersions;
    attempt: number;
    status: 'success' | 'failed';
    errorCode?: string;
    errorMessage?: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public firmwareUpdateResult(params: {
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v1' | 'v2';
    firmwareVersions: IFirmwareVersions;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
    status: 'success' | 'failed';
    errorCode?: string;
    errorMessage?: string;
    retryCount?: number;
    durationMs?: number;
  }) {
    return params;
  }
}
