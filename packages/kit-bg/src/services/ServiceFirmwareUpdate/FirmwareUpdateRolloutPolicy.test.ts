import type { IFirmwareUpdateRolloutConfig } from '@onekeyhq/shared/src/request/types/ipTable';

import {
  BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
  evaluateFirmwareUpdateRollout,
  resolveFirmwareUpdateRolloutConfig,
} from './FirmwareUpdateRolloutPolicy';

const buildRemoteConfig = (
  overrides: Partial<IFirmwareUpdateRolloutConfig> = {},
): IFirmwareUpdateRolloutConfig => ({
  schemaVersion: 1,
  policyVersion: 7,
  salt: 'remote-salt',
  expiresAt: 2_000_000_000_000,
  coordinatorExternalOnly: {
    enabled: true,
    killSwitch: false,
    percentageBps: 10_000,
  },
  ...overrides,
});

const evaluate = (
  overrides: Partial<Parameters<typeof evaluateFirmwareUpdateRollout>[0]> = {},
) =>
  evaluateFirmwareUpdateRollout({
    signedRemoteConfig: buildRemoteConfig(),
    ruleName: 'coordinatorExternalOnly',
    installationKey: 'installation-1',
    platform: 'ios',
    deviceType: 'classic1s',
    appVersion: '6.6.0',
    now: 1_900_000_000_000,
    ...overrides,
  });

describe('FirmwareUpdateRolloutPolicy', () => {
  it('uses a valid unexpired signed policy', () => {
    expect(evaluate()).toMatchObject({
      allowed: true,
      reason: 'allowed',
      source: 'signed-remote',
      policyVersion: 7,
      engine: 'fnv1a32-v1',
    });
  });

  it('uses the bundled fail-safe policy when the signed policy is absent', () => {
    expect(
      resolveFirmwareUpdateRolloutConfig({
        signedRemoteConfig: undefined,
      }),
    ).toEqual({
      config: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
      source: 'bundled',
    });
  });

  it.each([
    undefined,
    { schemaVersion: 2 },
    buildRemoteConfig({ expiresAt: 1 }),
  ])('falls back for a missing, invalid, or expired policy', (policy) => {
    expect(
      evaluate({
        signedRemoteConfig: policy,
      }),
    ).toMatchObject({
      allowed: false,
      source: 'bundled',
      policyVersion: 0,
    });
  });

  it('makes a deterministic decision without exposing the installation key', () => {
    const first = evaluate();
    const second = evaluate();
    expect(second).toEqual(first);
    expect(first).not.toHaveProperty('installationKey');
    expect(first.cohortBucket).toBeGreaterThanOrEqual(0);
    expect(first.cohortBucket).toBeLessThan(10_000);
  });

  it('honors kill switch before percentage admission', () => {
    expect(
      evaluate({
        signedRemoteConfig: buildRemoteConfig({
          coordinatorExternalOnly: {
            enabled: true,
            killSwitch: true,
            percentageBps: 10_000,
          },
        }),
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'kill_switch',
    });
  });

  it('checks platform, device type, and minimum App version', () => {
    const signedRemoteConfig = buildRemoteConfig({
      coordinatorExternalOnly: {
        enabled: true,
        killSwitch: false,
        percentageBps: 10_000,
        allowPlatforms: ['android'],
        allowDeviceTypes: ['pro2'],
        minAppVersion: '6.7.0',
      },
    });

    expect(evaluate({ signedRemoteConfig })).toMatchObject({
      reason: 'platform_not_allowed',
    });
    expect(
      evaluate({
        signedRemoteConfig,
        platform: 'android',
      }),
    ).toMatchObject({
      reason: 'device_type_not_allowed',
    });
    expect(
      evaluate({
        signedRemoteConfig,
        platform: 'android',
        deviceType: 'pro2',
      }),
    ).toMatchObject({
      reason: 'app_version_too_low',
    });
  });

  it('applies the percentage threshold to the stable cohort bucket', () => {
    const admitted = evaluate();
    const denied = evaluate({
      signedRemoteConfig: buildRemoteConfig({
        coordinatorExternalOnly: {
          enabled: true,
          killSwitch: false,
          percentageBps: admitted.cohortBucket,
        },
      }),
    });
    expect(denied).toMatchObject({
      allowed: false,
      reason: 'outside_percentage',
    });
  });
});
