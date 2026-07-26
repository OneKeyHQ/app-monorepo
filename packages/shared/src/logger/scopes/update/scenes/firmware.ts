import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IFirmwareVersions } from './firmwareVersions';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

export { parseFirmwareVersions } from './firmwareVersions';

type TFirmwareTransactionPhase =
  | 'DISCOVERING'
  | 'PLAN_CREATED'
  | 'ELIGIBILITY_CHECKING'
  | 'ACQUIRING'
  | 'MATERIALIZING'
  | 'PREPARED'
  | 'ENTERING_LOADER'
  | 'TRANSFERRING'
  | 'INSTALLING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PAUSED'
  | 'FAILED'
  | 'ABANDONED'
  | 'RECOVERY_UNSUPPORTED';

export class FirmwareScene extends BaseScene {
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

  @LogToServer()
  @LogToLocal()
  public firmwareRolloutDecision(params: {
    engine: 'transaction';
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    allowed: boolean;
    reason: string;
    policyVersion: number;
    cohortBucket: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public firmwareArtifactAcquired(params: {
    engine: 'transaction';
    deviceType: IDeviceType | undefined;
    updateFlow: 'v2' | 'v3' | 'v4';
    manifestSource:
      | 'verified-remote'
      | 'last-good-cache'
      | 'app-bundled-catalog';
    routeType: 'domain' | 'pinnedIp';
    candidateIndex: number;
    artifactBytes: number;
    durationMs: number;
    bytesReused: number;
    resumeKind: 'none' | 'range' | 'segments';
    resumeCount: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public firmwareTransactionPhaseChanged(params: {
    engine: 'transaction';
    phase: TFirmwareTransactionPhase;
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v2' | 'v3' | 'v4';
    sdkErrorCode?: string;
    policyVersion: number;
    cohortBucket: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public firmwareTransactionRecovered(params: {
    engine: 'transaction';
    phase: TFirmwareTransactionPhase;
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v2' | 'v3' | 'v4';
    recoveryKind:
      | 'attach'
      | 'final-verify'
      | 'range-resume'
      | 'reconcile'
      | 'wait-device';
    policyVersion: number;
    cohortBucket: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public firmwareTransactionInFlight(params: {
    engine: 'transaction';
    phase: TFirmwareTransactionPhase;
    deviceType: IDeviceType | undefined;
    transportType: EHardwareTransportType | undefined;
    updateFlow: 'v2' | 'v3' | 'v4';
    durationMs: number;
    thresholdMs: number;
    policyVersion: number;
    cohortBucket: number;
  }) {
    return params;
  }
}
