import {
  EDeviceCpuTier,
  EDeviceMemoryClass,
} from '@onekeyhq/shared/src/performance/devicePerformanceTierTypes';

export enum ETabPreloadMode {
  full = 'full',
  light = 'light',
  disabled = 'disabled',
}

export type ITabPreloadReason =
  | 'cpu-high'
  | 'cpu-low'
  | 'cpu-medium'
  | 'cpu-unknown'
  | 'legacy-high'
  | 'legacy-low'
  | 'legacy-medium'
  | 'memory-constrained'
  | 'surface-limited';

export interface ITabPreloadDecision {
  mode: ETabPreloadMode;
  reason: ITabPreloadReason;
}

export function resolveTabPreloadDecision({
  cpuTier,
  memoryClass,
  allowFullPreload = true,
}: {
  cpuTier: EDeviceCpuTier;
  memoryClass: EDeviceMemoryClass;
  allowFullPreload?: boolean;
}): ITabPreloadDecision {
  if (memoryClass === EDeviceMemoryClass.constrained) {
    return {
      mode: ETabPreloadMode.disabled,
      reason: 'memory-constrained',
    };
  }
  if (cpuTier === EDeviceCpuTier.low) {
    return { mode: ETabPreloadMode.disabled, reason: 'cpu-low' };
  }
  if (cpuTier === EDeviceCpuTier.high) {
    if (!allowFullPreload) {
      return { mode: ETabPreloadMode.light, reason: 'surface-limited' };
    }
    return { mode: ETabPreloadMode.full, reason: 'cpu-high' };
  }
  if (cpuTier === EDeviceCpuTier.medium) {
    return { mode: ETabPreloadMode.light, reason: 'cpu-medium' };
  }
  return { mode: ETabPreloadMode.light, reason: 'cpu-unknown' };
}
