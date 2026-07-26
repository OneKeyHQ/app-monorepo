import { EDeviceType } from '@onekeyfe/hd-shared';

import { FirmwareScene } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmware';
import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { FirmwareUpdateAnalytics } from './FirmwareUpdateAnalytics';

const CONTEXT = {
  deviceType: EDeviceType.Classic1s,
  transportType: EHardwareTransportType.BLE,
  updateFlow: 'v2',
  policyVersion: 11,
  cohortBucket: 123,
} as const;

const createScene = () => ({
  firmwareRolloutDecision: jest.fn(),
  firmwareArtifactAcquired: jest.fn(),
  firmwareTransactionPhaseChanged: jest.fn(),
  firmwareTransactionRecovered: jest.fn(),
  firmwareTransactionInFlight: jest.fn(),
});

describe('FirmwareUpdateAnalytics', () => {
  it('preserves the five historical firmware event methods', () => {
    for (const methodName of [
      'firmwareUpdateStarted',
      'firmwareUpdateAttemptResult',
      'firmwareUpdateResult',
      'firmwareSwitchStart',
      'firmwareSwitchSuccess',
    ] as const) {
      expect(
        Object.getOwnPropertyDescriptor(FirmwareScene.prototype, methodName)
          ?.value,
      ).toEqual(expect.any(Function));
    }
  });

  it('deduplicates rollout, artifact, phase, and recovery events', () => {
    const scene = createScene();
    const analytics = new FirmwareUpdateAnalytics(scene as never);

    analytics.recordRolloutDecision({
      sessionId: 'session-1',
      context: CONTEXT,
      allowed: true,
      reason: 'allowed',
    });
    analytics.recordRolloutDecision({
      sessionId: 'session-1',
      context: CONTEXT,
      allowed: true,
      reason: 'allowed',
    });
    analytics.recordArtifactAcquired({
      sessionId: 'session-1',
      artifactId: 'firmware-main',
      context: CONTEXT,
      manifestSource: 'app-bundled-catalog',
      routeType: 'pinnedIp',
      candidateIndex: 0,
      artifactBytes: 4096,
      durationMs: 1000,
      bytesReused: 2048,
      resumeKind: 'range',
      resumeCount: 1,
    });
    analytics.recordArtifactAcquired({
      sessionId: 'session-1',
      artifactId: 'firmware-main',
      context: CONTEXT,
      manifestSource: 'app-bundled-catalog',
      routeType: 'domain',
      candidateIndex: 1,
      artifactBytes: 4096,
      durationMs: 1200,
      bytesReused: 0,
      resumeKind: 'none',
      resumeCount: 0,
    });
    analytics.recordPhaseChanged({
      sessionId: 'session-1',
      revision: 3,
      phase: 'ACQUIRING',
      context: CONTEXT,
    });
    analytics.recordPhaseChanged({
      sessionId: 'session-1',
      revision: 3,
      phase: 'MATERIALIZING',
      context: CONTEXT,
    });
    analytics.recordRecovery({
      sessionId: 'session-1',
      recoveryAttemptId: 'attempt-1',
      phase: 'PAUSED',
      recoveryKind: 'range-resume',
      context: CONTEXT,
    });
    analytics.recordRecovery({
      sessionId: 'session-1',
      recoveryAttemptId: 'attempt-1',
      phase: 'PAUSED',
      recoveryKind: 'range-resume',
      context: CONTEXT,
    });

    expect(scene.firmwareRolloutDecision).toHaveBeenCalledTimes(1);
    expect(scene.firmwareArtifactAcquired).toHaveBeenCalledTimes(1);
    expect(scene.firmwareTransactionPhaseChanged).toHaveBeenCalledTimes(1);
    expect(scene.firmwareTransactionRecovered).toHaveBeenCalledTimes(1);
  });

  it('emits a named long-phase event once instead of a heartbeat', () => {
    const scene = createScene();
    const analytics = new FirmwareUpdateAnalytics(scene as never);

    expect(
      analytics.recordInFlightOnce({
        sessionId: 'session-1',
        phase: 'TRANSFERRING',
        phaseStartedAt: 1000,
        thresholdMs: 5000,
        now: 5999,
        context: CONTEXT,
      }),
    ).toBe(false);
    expect(
      analytics.recordInFlightOnce({
        sessionId: 'session-1',
        phase: 'TRANSFERRING',
        phaseStartedAt: 1000,
        thresholdMs: 5000,
        now: 6000,
        context: CONTEXT,
      }),
    ).toBe(true);
    expect(
      analytics.recordInFlightOnce({
        sessionId: 'session-1',
        phase: 'TRANSFERRING',
        phaseStartedAt: 1000,
        thresholdMs: 5000,
        now: 9000,
        context: CONTEXT,
      }),
    ).toBe(false);
    expect(scene.firmwareTransactionInFlight).toHaveBeenCalledTimes(1);
  });

  it('sends only the stable low-cardinality telemetry fields', () => {
    const scene = createScene();
    const analytics = new FirmwareUpdateAnalytics(scene as never);
    analytics.recordArtifactAcquired({
      sessionId: 'raw-device-uuid',
      artifactId: '/Users/alice/private/firmware.bin',
      context: CONTEXT,
      manifestSource: 'verified-remote',
      routeType: 'pinnedIp',
      candidateIndex: 2,
      artifactBytes: 83_854_948,
      durationMs: 5000,
      bytesReused: 4_194_304,
      resumeKind: 'segments',
      resumeCount: 2,
    });

    const payload = scene.firmwareArtifactAcquired.mock.calls[0]?.[0];
    expect(Object.keys(payload)).toEqual([
      'engine',
      'deviceType',
      'updateFlow',
      'manifestSource',
      'routeType',
      'candidateIndex',
      'artifactBytes',
      'durationMs',
      'bytesReused',
      'resumeKind',
      'resumeCount',
    ]);
    expect(JSON.stringify(payload)).not.toMatch(
      /(?:https?:|\/Users\/|artifactRef|stableDeviceId|raw-device-uuid)/u,
    );
  });

  it('rejects unstable SDK error text instead of logging it', () => {
    const scene = createScene();
    const analytics = new FirmwareUpdateAnalytics(scene as never);

    expect(() =>
      analytics.recordPhaseChanged({
        sessionId: 'session-1',
        revision: 4,
        phase: 'PAUSED',
        context: CONTEXT,
        sdkErrorCode: 'GET https://example.com failed',
      }),
    ).toThrow('stable bounded code');
    expect(scene.firmwareTransactionPhaseChanged).not.toHaveBeenCalled();
  });
});
