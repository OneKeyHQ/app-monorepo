import {
  EDeviceCpuTier,
  type TKnownDeviceCpuTier,
} from './devicePerformanceTierTypes';

export const LOW_LOGICAL_PROCESSOR_MAX = 4;
export const HIGH_LOGICAL_PROCESSOR_MIN = 8;

export function normalizeDeviceCpuTierKeyPart(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function resolveLogicalProcessorCpuTier(
  logicalProcessorCount: unknown,
): TKnownDeviceCpuTier | null {
  // This is a deterministic concurrency proxy, not a CPU benchmark. Browser
  // values can be reduced for privacy, so callers retain medium confidence.
  if (
    typeof logicalProcessorCount !== 'number' ||
    !Number.isInteger(logicalProcessorCount) ||
    logicalProcessorCount <= 0
  ) {
    return null;
  }
  if (logicalProcessorCount <= LOW_LOGICAL_PROCESSOR_MAX) {
    return EDeviceCpuTier.low;
  }
  if (logicalProcessorCount >= HIGH_LOGICAL_PROCESSOR_MIN) {
    return EDeviceCpuTier.high;
  }
  return EDeviceCpuTier.medium;
}
