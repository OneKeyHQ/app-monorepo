import platformEnv from '../platformEnv';

import { getCurrentOsVersion } from './currentOsVersion';
import { OS_END_OF_SUPPORT_RULES } from './rules';

import type {
  IOsEndOfSupportNotice,
  IOsEndOfSupportPlatform,
  IOsEndOfSupportRule,
} from './types';

export type * from './types';

function parseVersion(version: string): number[] | undefined {
  const segments = version.trim().split('.');
  const numbers = segments.map((segment) => parseInt(segment, 10));
  if (!version.trim() || numbers.some((n) => Number.isNaN(n))) {
    return undefined;
  }
  return numbers;
}

// Returns undefined when either side cannot be parsed, so an unexpected
// version string never produces a false notice.
export function isOsVersionBelow(
  currentVersion: string,
  minSupportedVersion: string,
): boolean | undefined {
  const current = parseVersion(currentVersion);
  const min = parseVersion(minSupportedVersion);
  if (!current || !min) {
    return undefined;
  }
  const length = Math.max(current.length, min.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (current[i] ?? 0) - (min[i] ?? 0);
    if (diff !== 0) {
      return diff < 0;
    }
  }
  return false;
}

export function resolveOsEndOfSupportNotice({
  platform,
  rule,
  currentVersion,
}: {
  platform: IOsEndOfSupportPlatform | undefined;
  rule: IOsEndOfSupportRule | undefined;
  currentVersion: string | undefined;
}): IOsEndOfSupportNotice | undefined {
  if (!platform || !rule || !currentVersion) {
    return undefined;
  }
  if (!isOsVersionBelow(currentVersion, rule.minSupportedVersion)) {
    return undefined;
  }
  return {
    id: `os-end-of-support:${platform}:${rule.minSupportedVersion}`,
    minSupportedName: rule.minSupportedName,
    learnMoreUrl: rule.learnMoreUrl,
  };
}

function getOsEndOfSupportPlatform(): IOsEndOfSupportPlatform | undefined {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  if (platformEnv.isDesktopMac) return 'mac';
  if (platformEnv.isDesktopWin) return 'win';
  if (platformEnv.isDesktopLinux) return 'linux';
  return undefined;
}

export function getOsEndOfSupportNotice(): IOsEndOfSupportNotice | undefined {
  const platform = getOsEndOfSupportPlatform();
  return resolveOsEndOfSupportNotice({
    platform,
    rule: platform ? OS_END_OF_SUPPORT_RULES[platform] : undefined,
    currentVersion: getCurrentOsVersion(),
  });
}
