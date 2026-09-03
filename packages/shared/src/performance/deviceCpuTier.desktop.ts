import { resolveLogicalProcessorCpuTier } from './deviceCpuTierUtils';

import type { IDeviceCpuTierMatch } from './devicePerformanceTierTypes';

export function getDeviceCpuTierMatch(): IDeviceCpuTierMatch | null {
  const bridgedLogicalProcessorCount =
    globalThis.desktopApi?.logicalProcessorCount;
  const bridgedTier = resolveLogicalProcessorCpuTier(
    bridgedLogicalProcessorCount,
  );
  if (bridgedTier !== null) {
    return {
      tier: bridgedTier,
      source: 'desktopLogicalProcessorCount',
      confidence: 'medium',
    };
  }
  const browserTier = resolveLogicalProcessorCpuTier(
    typeof navigator === 'undefined'
      ? undefined
      : navigator.hardwareConcurrency,
  );
  if (browserTier === null) {
    return null;
  }
  return {
    tier: browserTier,
    source: 'browserHardwareConcurrency',
    confidence: 'medium',
  };
}
