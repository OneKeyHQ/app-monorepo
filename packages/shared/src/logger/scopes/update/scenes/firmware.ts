import type { IFirmwareUpdateFailureType } from '@onekeyhq/shared/src/errors/utils/firmwareUpdateErrorUtils';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { IFirmwareVersions } from './firmwareVersions';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

export type IFirmwareArtifactDownloadTelemetry = {
  deviceType: string;
  firmwareType: string;
  releaseChannel: 'stable' | 'pre-release';
  source: 'prefetch' | 'upgrade' | 'self-test';
  artifactRole: string;
  targetVersion?: string;
  sha256?: string;
  phase: 'started' | 'finished';
  status?: 'success' | 'failed' | 'cancelled';
  cacheHit?: boolean;
  durationMs?: number;
  bytes?: number;
  errorCode?: string;
  platform: string;
};

export { parseFirmwareVersions } from './firmwareVersions';

export class FirmwareScene extends BaseScene {
  @LogToServer({ level: 'info', waitForServer: true })
  private firmwareArtifactDownload(params: IFirmwareArtifactDownloadTelemetry) {
    return params;
  }

  public reportArtifactDownload(
    params: IFirmwareArtifactDownloadTelemetry,
  ): Promise<void> {
    return this.firmwareArtifactDownload(params) as unknown as Promise<void>;
  }

  @LogToLocal({ level: 'info' })
  public artifactDownloadRecorded(params: IFirmwareArtifactDownloadTelemetry) {
    return params;
  }

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
    failureType?: IFirmwareUpdateFailureType;
    errorCode?: string;
    retryCount?: number;
    totalDurationMs?: number;
    transferredBytes?: number;
    totalBytes?: number;
    averageTransferRateBytesPerSecond?: number;
    transferDurationMs?: number;
  }) {
    return params;
  }
}
