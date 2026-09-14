/**
 * Web, desktop, and extension device capability classification.
 *
 * Logical processor count and memory are exposed as independent capabilities.
 * Browser-provided values may be reduced or rounded for privacy, so consumers
 * must keep conservative fallbacks for unknown devices.
 */

import { syncStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import { getDeviceCpuTierMatch } from './deviceCpuTier';
import { getDeviceMemoryGBSync, isLowEndMemory } from './deviceMemory';
import {
  NON_NATIVE_DEVICE_PERFORMANCE_DATA_VERSION,
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

// Cache per JS context so repeated consumers do not reread bridged or browser
// capability inputs. Each desktop renderer keeps its own deserialized snapshot.
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
    dataVersion: NON_NATIVE_DEVICE_PERFORMANCE_DATA_VERSION,
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

/** @deprecated Use getDevicePerformanceProfile and a feature-specific policy. */
export function getDevicePerformanceTier(): EDevicePerformanceTier {
  return cpuTierToLegacyPerformanceTier(getDeviceCpuTier());
}

/**
 * Kept for API compatibility. Web capabilities are available synchronously and
 * are not calibrated from application startup timing.
 */
export async function calibrateDevicePerformanceTier(): Promise<EDevicePerformanceTier> {
  return getDevicePerformanceTier();
}

export async function setDeviceCpuTier(
  tier: TKnownDeviceCpuTier,
): Promise<void> {
  const acknowledgement = syncStorage.set(
    EAppSyncStorageKeys.onekey_device_cpu_tier_override_v2,
    tier,
  );
  cachedProfile = createDevicePerformanceProfile();
  await acknowledgement;
}

export async function resetDeviceCpuTier(): Promise<void> {
  const acknowledgement = syncStorage.delete(
    EAppSyncStorageKeys.onekey_device_cpu_tier_override_v2,
  );
  cachedProfile = undefined;
  await acknowledgement;
}

/** @deprecated Use setDeviceCpuTier. */
export async function setDevicePerformanceTier(
  tier: EDevicePerformanceTier,
): Promise<void> {
  await setDeviceCpuTier(CPU_TIER_BY_LEGACY_PERFORMANCE_TIER[tier]);
}

/** @deprecated Use resetDeviceCpuTier. */
export async function resetDevicePerformanceTier(): Promise<void> {
  await resetDeviceCpuTier();
}
