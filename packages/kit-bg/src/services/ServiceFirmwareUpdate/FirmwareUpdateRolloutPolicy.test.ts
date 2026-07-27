import type { IIpTableConfigWithRuntime } from '@onekeyhq/shared/src/request/types/ipTable';
import type { verifyIpTableConfigSignatureDetailed } from '@onekeyhq/shared/src/utils/ipTableUtils';

import {
  BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
  evaluateFirmwareUpdateRollout,
} from './FirmwareUpdateRolloutPolicy';

const now = Date.parse('2026-07-27T00:00:00.000Z');

const makeConfig = ({
  enabled = true,
  killSwitch = false,
  percentageBps = 10_000,
  policyVersion = 4,
  expiresAt = now + 60_000,
}: {
  enabled?: boolean;
  killSwitch?: boolean;
  percentageBps?: number;
  policyVersion?: number;
  expiresAt?: number;
} = {}): IIpTableConfigWithRuntime => ({
  config: {
    version: 8,
    ttl_sec: 3600,
    generated_at: new Date(now - 1000).toISOString(),
    signature: '0xsigned',
    domains: {},
    firmware_rollout: {
      schemaVersion: 1,
      policyVersion,
      salt: 'test-salt',
      expiresAt,
      coordinatorExternalOnly: {
        enabled,
        killSwitch,
        percentageBps,
      },
    },
  },
  runtime: {
    enabled: true,
    lastUpdated: now,
    lastRegionCheck: now,
    selections: {},
    lastVerified: {
      at: now,
      version: 8,
      generatedAt: new Date(now - 1000).toISOString(),
      firmwarePolicyVersion: 4,
      payloadHash: '0123abcd',
    },
  },
});

const trustedVerifier = jest.fn<
  ReturnType<typeof verifyIpTableConfigSignatureDetailed>,
  Parameters<typeof verifyIpTableConfigSignatureDetailed>
>(async () => ({
  ok: true,
  recoveredAddress: '0xtrusted',
}));

const evaluate = (
  configWithRuntime: IIpTableConfigWithRuntime,
  installationKey = 'installation-1',
) =>
  evaluateFirmwareUpdateRollout({
    configWithRuntime,
    installationKey,
    platform: 'ios',
    deviceType: 'classic1s',
    appVersion: '6.0.0',
    now,
    verifyConfig: trustedVerifier,
  });

describe('FirmwareUpdateRolloutPolicy', () => {
  beforeEach(() => {
    trustedVerifier.mockClear();
  });

  test('uses a fail-closed bundled policy when signed policy is absent', async () => {
    const configWithRuntime = makeConfig();
    delete configWithRuntime.config.firmware_rollout;

    await expect(evaluate(configWithRuntime)).resolves.toMatchObject({
      allowed: false,
      reason: 'disabled',
      configReason: 'signed_config_missing',
      source: 'bundled',
      policyVersion: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG.policyVersion,
    });
    expect(trustedVerifier).not.toHaveBeenCalled();
  });

  test('uses a verified signed policy and keeps the cohort stable', async () => {
    const first = await evaluate(makeConfig());
    const second = await evaluate(makeConfig());

    expect(first).toMatchObject({
      allowed: true,
      reason: 'allowed',
      configReason: 'signed_remote',
      source: 'signed-remote',
      policyVersion: 4,
      engine: 'fnv1a32-v1',
    });
    expect(second.cohortBucket).toBe(first.cohortBucket);
    expect(trustedVerifier).toHaveBeenCalledTimes(2);
  });

  test('kill switch denies creation even for an included cohort', async () => {
    await expect(
      evaluate(makeConfig({ killSwitch: true })),
    ).resolves.toMatchObject({
      allowed: false,
      reason: 'kill_switch',
      source: 'signed-remote',
    });
  });

  test('expired signed policy falls back without attempting signature verification', async () => {
    await expect(
      evaluate(makeConfig({ expiresAt: now - 1 })),
    ).resolves.toMatchObject({
      allowed: false,
      configReason: 'signed_config_expired',
      source: 'bundled',
    });
    expect(trustedVerifier).not.toHaveBeenCalled();
  });

  test('policy rollback falls back to the bundled deny rule', async () => {
    await expect(
      evaluate(makeConfig({ policyVersion: 3 })),
    ).resolves.toMatchObject({
      allowed: false,
      configReason: 'signed_policy_regression',
      source: 'bundled',
    });
    expect(trustedVerifier).not.toHaveBeenCalled();
  });

  test('never hashes an empty installation key into an eligible cohort', async () => {
    await expect(evaluate(makeConfig(), '')).resolves.toMatchObject({
      allowed: false,
      reason: 'installation_key_invalid',
      cohortBucket: 10_000,
    });
  });
});
