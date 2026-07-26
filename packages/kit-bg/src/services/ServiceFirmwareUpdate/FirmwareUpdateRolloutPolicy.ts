import semver from 'semver';

import type {
  IFirmwareUpdateRolloutConfig,
  IFirmwareUpdateRolloutPlatform,
  IFirmwareUpdateRolloutRule,
} from '@onekeyhq/shared/src/request/types/ipTable';
import { isValidFirmwareUpdateRolloutConfig } from '@onekeyhq/shared/src/utils/ipTableUtils';

export type EFirmwareUpdateRolloutRuleName =
  | 'p0Classic1sV2'
  | 'coordinatorExternalOnly';

export type EFirmwareUpdateRolloutDecisionReason =
  | 'allowed'
  | 'rule_missing'
  | 'disabled'
  | 'kill_switch'
  | 'platform_not_allowed'
  | 'device_type_not_allowed'
  | 'app_version_invalid'
  | 'app_version_too_low'
  | 'outside_percentage';

export type IFirmwareUpdateRolloutDecision = {
  allowed: boolean;
  reason: EFirmwareUpdateRolloutDecisionReason;
  source: 'bundled' | 'signed-remote';
  policyVersion: number;
  ruleName: EFirmwareUpdateRolloutRuleName;
  cohortBucket: number;
  engine: 'fnv1a32-v1';
};

export const BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG: IFirmwareUpdateRolloutConfig =
  Object.freeze({
    schemaVersion: 1,
    policyVersion: 0,
    salt: 'onekey-firmware-rollout-v1',
    expiresAt: Number.MAX_SAFE_INTEGER,
    p0Classic1sV2: Object.freeze({
      enabled: false,
      killSwitch: false,
      percentageBps: 0,
    }),
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

const getCohortBucket = ({
  salt,
  installationKey,
  ruleName,
}: {
  salt: string;
  installationKey: string;
  ruleName: EFirmwareUpdateRolloutRuleName;
}) => fnv1a32(`${salt}:${ruleName}:${installationKey}`) % 10_000;

const getRuleDecisionReason = ({
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
}): EFirmwareUpdateRolloutDecisionReason => {
  if (!rule) {
    return 'rule_missing';
  }
  if (rule.killSwitch) {
    return 'kill_switch';
  }
  if (!rule.enabled) {
    return 'disabled';
  }
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
  if (cohortBucket >= rule.percentageBps) {
    return 'outside_percentage';
  }
  return 'allowed';
};

export const resolveFirmwareUpdateRolloutConfig = ({
  signedRemoteConfig,
  now = Date.now(),
}: {
  signedRemoteConfig?: unknown;
  now?: number;
}): {
  config: IFirmwareUpdateRolloutConfig;
  source: IFirmwareUpdateRolloutDecision['source'];
} => {
  if (
    isValidFirmwareUpdateRolloutConfig(signedRemoteConfig) &&
    signedRemoteConfig.expiresAt >= now
  ) {
    return {
      config: signedRemoteConfig,
      source: 'signed-remote',
    };
  }
  return {
    config: BUNDLED_FIRMWARE_UPDATE_ROLLOUT_CONFIG,
    source: 'bundled',
  };
};

export const evaluateFirmwareUpdateRollout = ({
  signedRemoteConfig,
  ruleName,
  installationKey,
  platform,
  deviceType,
  appVersion,
  now = Date.now(),
}: {
  signedRemoteConfig?: unknown;
  ruleName: EFirmwareUpdateRolloutRuleName;
  installationKey: string;
  platform: IFirmwareUpdateRolloutPlatform;
  deviceType: string;
  appVersion: string;
  now?: number;
}): IFirmwareUpdateRolloutDecision => {
  const { config, source } = resolveFirmwareUpdateRolloutConfig({
    signedRemoteConfig,
    now,
  });
  const cohortBucket = getCohortBucket({
    salt: config.salt,
    installationKey,
    ruleName,
  });
  const reason = getRuleDecisionReason({
    rule: config[ruleName],
    cohortBucket,
    platform,
    deviceType,
    appVersion,
  });

  return Object.freeze({
    allowed: reason === 'allowed',
    reason,
    source,
    policyVersion: config.policyVersion,
    ruleName,
    cohortBucket,
    engine: 'fnv1a32-v1',
  });
};
