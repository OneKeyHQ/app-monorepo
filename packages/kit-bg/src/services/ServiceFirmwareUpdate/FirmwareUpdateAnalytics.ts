import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import type { EFirmwareUpdateCoordinatorPhase } from './firmwareUpdateCoordinatorTypes';
import type { EFirmwareUpdateRolloutDecisionReason } from './FirmwareUpdateRolloutPolicy';

type IFirmwareScene = typeof defaultLogger.update.firmware;

export type IFirmwareUpdateAnalyticsContext = {
  deviceType: Parameters<
    IFirmwareScene['firmwareRolloutDecision']
  >[0]['deviceType'];
  transportType: EHardwareTransportType | undefined;
  updateFlow: 'v2' | 'v3' | 'v4';
  policyVersion: number;
  cohortBucket: number;
};

const assertSafeInteger = (value: number, field: string) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
};

const assertSdkErrorCode = (value: string | undefined) => {
  if (value !== undefined && !/^[A-Z][A-Z0-9_]{0,63}$/u.test(value)) {
    throw new TypeError('sdkErrorCode must be a stable bounded code');
  }
};

export class FirmwareUpdateAnalytics {
  private readonly rolloutKeys = new Set<string>();

  private readonly artifactKeys = new Set<string>();

  private readonly phaseKeys = new Set<string>();

  private readonly recoveryKeys = new Set<string>();

  private readonly inFlightKeys = new Set<string>();

  constructor(
    private readonly scene: IFirmwareScene = defaultLogger.update.firmware,
  ) {}

  recordRolloutDecision({
    sessionId,
    context,
    allowed,
    reason,
  }: {
    sessionId: string;
    context: IFirmwareUpdateAnalyticsContext;
    allowed: boolean;
    reason: EFirmwareUpdateRolloutDecisionReason;
  }) {
    if (this.rolloutKeys.has(sessionId)) return;
    assertSafeInteger(context.policyVersion, 'policyVersion');
    assertSafeInteger(context.cohortBucket, 'cohortBucket');
    this.rolloutKeys.add(sessionId);
    this.scene.firmwareRolloutDecision({
      engine: 'transaction',
      deviceType: context.deviceType,
      transportType: context.transportType,
      allowed,
      reason,
      policyVersion: context.policyVersion,
      cohortBucket: context.cohortBucket,
    });
  }

  recordArtifactAcquired({
    sessionId,
    artifactId,
    context,
    manifestSource,
    routeType,
    candidateIndex,
    artifactBytes,
    durationMs,
    bytesReused,
    resumeKind,
    resumeCount,
  }: {
    sessionId: string;
    artifactId: string;
    context: IFirmwareUpdateAnalyticsContext;
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
    const key = `${sessionId}\u0000${artifactId}`;
    if (this.artifactKeys.has(key)) return;
    [
      ['candidateIndex', candidateIndex],
      ['artifactBytes', artifactBytes],
      ['durationMs', durationMs],
      ['bytesReused', bytesReused],
      ['resumeCount', resumeCount],
    ].forEach(([field, value]) =>
      assertSafeInteger(value as number, field as string),
    );
    this.artifactKeys.add(key);
    this.scene.firmwareArtifactAcquired({
      engine: 'transaction',
      deviceType: context.deviceType,
      updateFlow: context.updateFlow,
      manifestSource,
      routeType,
      candidateIndex,
      artifactBytes,
      durationMs,
      bytesReused,
      resumeKind,
      resumeCount,
    });
  }

  recordPhaseChanged({
    sessionId,
    revision,
    phase,
    context,
    sdkErrorCode,
  }: {
    sessionId: string;
    revision: number;
    phase: EFirmwareUpdateCoordinatorPhase;
    context: IFirmwareUpdateAnalyticsContext;
    sdkErrorCode?: string;
  }) {
    assertSafeInteger(revision, 'revision');
    assertSdkErrorCode(sdkErrorCode);
    const key = `${sessionId}\u0000${revision}`;
    if (this.phaseKeys.has(key)) return;
    this.phaseKeys.add(key);
    this.scene.firmwareTransactionPhaseChanged({
      engine: 'transaction',
      phase,
      deviceType: context.deviceType,
      transportType: context.transportType,
      updateFlow: context.updateFlow,
      ...(sdkErrorCode ? { sdkErrorCode } : {}),
      policyVersion: context.policyVersion,
      cohortBucket: context.cohortBucket,
    });
  }

  recordRecovery({
    sessionId,
    recoveryAttemptId,
    phase,
    recoveryKind,
    context,
  }: {
    sessionId: string;
    recoveryAttemptId: string;
    phase: EFirmwareUpdateCoordinatorPhase;
    recoveryKind:
      | 'attach'
      | 'final-verify'
      | 'range-resume'
      | 'reconcile'
      | 'wait-device';
    context: IFirmwareUpdateAnalyticsContext;
  }) {
    const key = `${sessionId}\u0000${recoveryAttemptId}`;
    if (this.recoveryKeys.has(key)) return;
    this.recoveryKeys.add(key);
    this.scene.firmwareTransactionRecovered({
      engine: 'transaction',
      phase,
      deviceType: context.deviceType,
      transportType: context.transportType,
      updateFlow: context.updateFlow,
      recoveryKind,
      policyVersion: context.policyVersion,
      cohortBucket: context.cohortBucket,
    });
  }

  recordInFlightOnce({
    sessionId,
    phase,
    phaseStartedAt,
    thresholdMs,
    context,
    now = Date.now(),
  }: {
    sessionId: string;
    phase: EFirmwareUpdateCoordinatorPhase;
    phaseStartedAt: number;
    thresholdMs: number;
    context: IFirmwareUpdateAnalyticsContext;
    now?: number;
  }): boolean {
    const durationMs = now - phaseStartedAt;
    assertSafeInteger(thresholdMs, 'thresholdMs');
    if (durationMs < thresholdMs) return false;
    const key = `${sessionId}\u0000${phase}`;
    if (this.inFlightKeys.has(key)) return false;
    assertSafeInteger(durationMs, 'durationMs');
    this.inFlightKeys.add(key);
    this.scene.firmwareTransactionInFlight({
      engine: 'transaction',
      phase,
      deviceType: context.deviceType,
      transportType: context.transportType,
      updateFlow: context.updateFlow,
      durationMs,
      thresholdMs,
      policyVersion: context.policyVersion,
      cohortBucket: context.cohortBucket,
    });
    return true;
  }

  forgetSession(sessionId: string) {
    const prefix = `${sessionId}\u0000`;
    this.rolloutKeys.delete(sessionId);
    [
      this.artifactKeys,
      this.phaseKeys,
      this.recoveryKeys,
      this.inFlightKeys,
    ].forEach((keys) => {
      [...keys].forEach((key) => {
        if (key.startsWith(prefix)) keys.delete(key);
      });
    });
  }
}
