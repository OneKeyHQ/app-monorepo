/**
 * Native device performance classification.
 *
 * CPU benchmark mappings and physical memory are exposed as independent
 * capabilities. Feature owners combine only the signals relevant to their
 * policy. Startup timing is intentionally excluded because it is an
 * application outcome rather than a stable hardware capability.
 */

import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import { getDeviceCpuTierMatch } from './deviceCpuTier';
import { getDeviceMemoryGBSync, isLowEndMemory } from './deviceMemory';
import {
  NATIVE_DEVICE_PERFORMANCE_DATA_VERSION,
  resolveDevicePerformanceProfile,
} from './devicePerformanceTierResolver';
import {
  EDeviceCpuTier,
  EDeviceMemoryClass,
  EDevicePerformanceTier,
  type IDevicePerformanceProfile,
  type TKnownDeviceCpuTier,
} from './devicePerformanceTierTypes';

export { EDeviceCpuTier, EDeviceMemoryClass, EDevicePerformanceTier };
export type { IDevicePerformanceProfile };

// Native main and background runtimes have separate JS heaps, so each runtime
// keeps its own snapshot and reads native-backed capability inputs at most once.
let cachedProfile: IDevicePerformanceProfile | undefined;

const CPU_TIER_BY_LEGACY_PERFORMANCE_TIER: Record<
  EDevicePerformanceTier,
  TKnownDeviceCpuTier
> = {
  [EDevicePerformanceTier.high]: EDeviceCpuTier.high,
  [EDevicePerformanceTier.medium]: EDeviceCpuTier.medium,
  [EDevicePerformanceTier.low]: EDeviceCpuTier.low,
};

function getStoredCpuOverride(): TKnownDeviceCpuTier | undefined {
  const stored = syncStorage.getString(
    EAppSyncStorageKeys.onekey_device_cpu_tier_override_v2,
  );
  if (
    stored === EDeviceCpuTier.high ||
    stored === EDeviceCpuTier.medium ||
    stored === EDeviceCpuTier.low
  ) {
    return stored;
  }
  return undefined;
}

function createDevicePerformanceProfile(): IDevicePerformanceProfile {
  const memoryGB = getDeviceMemoryGBSync();
  return resolveDevicePerformanceProfile({
    cpuTierMatch: getDeviceCpuTierMatch(),
    memoryGB,
    isMemoryConstrained: memoryGB !== null ? isLowEndMemory(memoryGB) : false,
    overrideCpuTier: getStoredCpuOverride(),
    dataVersion: NATIVE_DEVICE_PERFORMANCE_DATA_VERSION,
  });
}

export function getDevicePerformanceProfile(): IDevicePerformanceProfile {
  cachedProfile ??= createDevicePerformanceProfile();
  return cachedProfile;
}

export function getDeviceCpuTier(): EDeviceCpuTier {
  return getDevicePerformanceProfile().cpu.tier;
}

function cpuTierToLegacyPerformanceTier(
  tier: EDeviceCpuTier,
): EDevicePerformanceTier {
  if (tier === EDeviceCpuTier.high) {
    return EDevicePerformanceTier.high;
  }
  if (tier === EDeviceCpuTier.low) {
    return EDevicePerformanceTier.low;
  }
  return EDevicePerformanceTier.medium;
}

/**
 * @deprecated Use getDevicePerformanceProfile and a feature-specific policy.
 */
export function getDevicePerformanceTier(): EDevicePerformanceTier {
  return cpuTierToLegacyPerformanceTier(getDeviceCpuTier());
}

/**
 * Kept for API compatibility with non-native targets. Native classification is
 * deterministic and does not calibrate from startup timing.
 */
export async function calibrateDevicePerformanceTier(): Promise<EDevicePerformanceTier> {
  return getDevicePerformanceTier();
}

export function setDeviceCpuTier(tier: TKnownDeviceCpuTier): void {
  syncStorage.set(EAppSyncStorageKeys.onekey_device_cpu_tier_override_v2, tier);
  cachedProfile = createDevicePerformanceProfile();
}

export function resetDeviceCpuTier(): void {
  syncStorage.delete(EAppSyncStorageKeys.onekey_device_cpu_tier_override_v2);
  cachedProfile = undefined;
}

/** @deprecated Use setDeviceCpuTier. */
export function setDevicePerformanceTier(tier: EDevicePerformanceTier): void {
  setDeviceCpuTier(CPU_TIER_BY_LEGACY_PERFORMANCE_TIER[tier]);
}

/** @deprecated Use resetDeviceCpuTier. */
export function resetDevicePerformanceTier(): void {
  resetDeviceCpuTier();
}
