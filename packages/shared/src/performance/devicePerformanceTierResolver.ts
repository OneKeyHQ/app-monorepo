import {
  EDeviceCpuTier,
  EDeviceMemoryClass,
  type IDeviceCpuTierMatch,
  type IDevicePerformanceProfile,
  type TKnownDeviceCpuTier,
} from './devicePerformanceTierTypes';

export const NATIVE_DEVICE_PERFORMANCE_DATA_VERSION = 'native-cpu-v1';
export const NON_NATIVE_DEVICE_PERFORMANCE_DATA_VERSION =
  'non-native-capabilities-v1';
export const LARGE_DEVICE_MEMORY_THRESHOLD_GB = 6;

export function resolveMemoryClass({
  memoryGB,
  isMemoryConstrained,
}: {
  memoryGB: number | null;
  isMemoryConstrained: boolean;
}): EDeviceMemoryClass {
  if (memoryGB === null || !Number.isFinite(memoryGB) || memoryGB <= 0) {
    return EDeviceMemoryClass.unknown;
  }
  if (isMemoryConstrained) {
    return EDeviceMemoryClass.constrained;
  }
  if (memoryGB > LARGE_DEVICE_MEMORY_THRESHOLD_GB) {
    return EDeviceMemoryClass.large;
  }
  return EDeviceMemoryClass.standard;
}

export function resolveDevicePerformanceProfile({
  cpuTierMatch,
  memoryGB,
  isMemoryConstrained,
  overrideCpuTier,
  dataVersion,
}: {
  cpuTierMatch: IDeviceCpuTierMatch | null;
  memoryGB: number | null;
  isMemoryConstrained: boolean;
  overrideCpuTier?: TKnownDeviceCpuTier;
  dataVersion: string;
}): IDevicePerformanceProfile {
  return {
    cpu: {
      tier: overrideCpuTier ?? cpuTierMatch?.tier ?? EDeviceCpuTier.unknown,
      source: overrideCpuTier
        ? 'developerOverride'
        : (cpuTierMatch?.source ?? 'unknown'),
      confidence: overrideCpuTier
        ? 'high'
        : (cpuTierMatch?.confidence ?? 'none'),
    },
    memory: {
      class: resolveMemoryClass({
        memoryGB,
        isMemoryConstrained,
      }),
      totalGB: memoryGB,
    },
    dataVersion,
  };
}
