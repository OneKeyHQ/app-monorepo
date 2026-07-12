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
  | 'memory-constrained';

export interface ITabPreloadDecision {
  mode: ETabPreloadMode;
  reason: ITabPreloadReason;
}

export function resolveNativeTabPreloadDecision({
  cpuTier,
  memoryClass,
}: {
  cpuTier: EDeviceCpuTier;
  memoryClass: EDeviceMemoryClass;
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
    return { mode: ETabPreloadMode.full, reason: 'cpu-high' };
  }
  if (cpuTier === EDeviceCpuTier.medium) {
    return { mode: ETabPreloadMode.light, reason: 'cpu-medium' };
  }
  return { mode: ETabPreloadMode.light, reason: 'cpu-unknown' };
}
