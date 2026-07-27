import semver from 'semver';

import type {
  IFirmwareUpdateRolloutConfig,
  IFirmwareUpdateRolloutPlatform,
  IFirmwareUpdateRolloutRule,
  IIpTableConfigWithRuntime,
} from '@onekeyhq/shared/src/request/types/ipTable';
import {
  isValidFirmwareUpdateRolloutConfig,
  isValidIpTableRemoteConfigShape,
  verifyIpTableConfigSignatureDetailed,
} from '@onekeyhq/shared/src/utils/ipTableUtils';

export type IFirmwareUpdateRolloutDecision = {
  allowed: boolean;
  reason:
    | 'allowed'
    | 'rule_missing'
    | 'disabled'
    | 'kill_switch'
    | 'platform_not_allowed'
    | 'device_type_not_allowed'
    | 'app_version_invalid'
    | 'app_version_too_low'
    | 'outside_percentage'
    | 'installation_key_invalid';
  configReason:
    | 'signed_remote'
    | 'signed_config_missing'
    | 'signed_config_invalid'
    | 'signed_config_untrusted'
    | 'signed_config_expired'
    | 'signed_policy_regression';
  source: 'bundled' | 'signed-remote';
  policyVersion: number;
  cohortBucket: number;
  ruleName: 'coordinatorExternalOnly';
  engine: 'fnv1a32-v1';
  rule: {
    enabled: boolean;
    killSwitch: boolean;
    percentageBps: number;
  };
};

export const BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG: IFirmwareUpdateRolloutConfig =
  Object.freeze({
    schemaVersion: 1,
    policyVersion: 0,
    salt: 'onekey-firmware-rollout-v1',
    expiresAt: Number.MAX_SAFE_INTEGER,
    coordinatorExternalOnly: Object.freeze({
      enabled: false,
      killSwitch: false,
      percentageBps: 0,
    }),
  });

const fnv1a32 = (value: string): number => {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }
  return hash;
};

const selectConfig = async ({
  configWithRuntime,
  now,
  verifyConfig,
}: {
  configWithRuntime: IIpTableConfigWithRuntime;
  now: number;
  verifyConfig: typeof verifyIpTableConfigSignatureDetailed;
}): Promise<{
  config: IFirmwareUpdateRolloutConfig;
  source: IFirmwareUpdateRolloutDecision['source'];
  configReason: IFirmwareUpdateRolloutDecision['configReason'];
}> => {
  const { config, runtime } = configWithRuntime;
  if (!config.firmware_rollout) {
    return {
      config: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
      source: 'bundled',
      configReason: 'signed_config_missing',
    };
  }
  if (
    !isValidIpTableRemoteConfigShape(config) ||
    !isValidFirmwareUpdateRolloutConfig(config.firmware_rollout)
  ) {
    return {
      config: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
      source: 'bundled',
      configReason: 'signed_config_invalid',
    };
  }
  const generatedAt = Date.parse(config.generated_at);
  const envelopeExpiresAt = generatedAt + config.ttl_sec * 1000;
  if (
    !Number.isFinite(envelopeExpiresAt) ||
    envelopeExpiresAt < now ||
    config.firmware_rollout.expiresAt < now
  ) {
    return {
      config: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
      source: 'bundled',
      configReason: 'signed_config_expired',
    };
  }
  const acceptedPolicyVersion =
    runtime?.lastVerified?.firmwarePolicyVersion ?? 0;
  if (config.firmware_rollout.policyVersion < acceptedPolicyVersion) {
    return {
      config: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
      source: 'bundled',
      configReason: 'signed_policy_regression',
    };
  }
  const verification = await verifyConfig(config);
  if (!verification.ok) {
    return {
      config: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
      source: 'bundled',
      configReason: 'signed_config_untrusted',
    };
  }
  return {
    config: config.firmware_rollout,
    source: 'signed-remote',
    configReason: 'signed_remote',
  };
};

const getRuleReason = ({
  rule,
  cohortBucket,
  platform,
  deviceType,
  appVersion,
}: {
  rule: IFirmwareUpdateRolloutRule | undefined;
  cohortBucket: number;
  platform: IFirmwareUpdateRolloutPlatform;
  deviceType: string;
  appVersion: string;
}): IFirmwareUpdateRolloutDecision['reason'] => {
  if (!rule) return 'rule_missing';
  if (rule.killSwitch) return 'kill_switch';
  if (!rule.enabled) return 'disabled';
  if (rule.allowPlatforms && !rule.allowPlatforms.includes(platform)) {
    return 'platform_not_allowed';
  }
  if (rule.allowDeviceTypes && !rule.allowDeviceTypes.includes(deviceType)) {
    return 'device_type_not_allowed';
  }
  if (rule.minAppVersion) {
    if (!semver.valid(appVersion) || !semver.valid(rule.minAppVersion)) {
      return 'app_version_invalid';
    }
    if (semver.lt(appVersion, rule.minAppVersion)) {
      return 'app_version_too_low';
    }
  }
  return cohortBucket < rule.percentageBps ? 'allowed' : 'outside_percentage';
};

export const evaluateFirmwareUpdateRollout = async ({
  configWithRuntime,
  installationKey,
  platform,
  deviceType,
  appVersion,
  now = Date.now(),
  verifyConfig = verifyIpTableConfigSignatureDetailed,
}: {
  configWithRuntime: IIpTableConfigWithRuntime;
  installationKey: string;
  platform: IFirmwareUpdateRolloutPlatform;
  deviceType: string;
  appVersion: string;
  now?: number;
  verifyConfig?: typeof verifyIpTableConfigSignatureDetailed;
}): Promise<IFirmwareUpdateRolloutDecision> => {
  const selection = await selectConfig({
    configWithRuntime,
    now,
    verifyConfig,
  });
  const ruleName = 'coordinatorExternalOnly' as const;
  const installationKeyValid =
    installationKey.length > 0 && installationKey.length <= 160;
  const cohortBucket = installationKeyValid
    ? fnv1a32(`${selection.config.salt}:${ruleName}:${installationKey}`) %
      10_000
    : 10_000;
  const rule = selection.config[ruleName];
  const reason = installationKeyValid
    ? getRuleReason({
        rule,
        cohortBucket,
        platform,
        deviceType,
        appVersion,
      })
    : 'installation_key_invalid';
  return Object.freeze({
    allowed: reason === 'allowed',
    reason,
    configReason: selection.configReason,
    source: selection.source,
    policyVersion: selection.config.policyVersion,
    cohortBucket,
    ruleName,
    engine: 'fnv1a32-v1',
    rule: Object.freeze({
      enabled: rule?.enabled ?? false,
      killSwitch: rule?.killSwitch ?? false,
      percentageBps: rule?.percentageBps ?? 0,
    }),
  });
};
