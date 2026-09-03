import { resolveLogicalProcessorCpuTier } from './deviceCpuTierUtils';

import type { IDeviceCpuTierMatch } from './devicePerformanceTierTypes';

export function getDeviceCpuTierMatch(): IDeviceCpuTierMatch | null {
  const tier = resolveLogicalProcessorCpuTier(
    typeof navigator === 'undefined'
      ? undefined
      : navigator.hardwareConcurrency,
  );
  if (tier === null) {
    return null;
  }
  return {
    tier,
    source: 'browserHardwareConcurrency',
    confidence: 'medium',
  };
}
