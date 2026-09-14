import type { EDeviceCpuTier } from '../performance/devicePerformanceTierTypes';

export type TAnalyticsTier = 1 | 2 | 3;

export function getAnalyticsTier(cpuTier: EDeviceCpuTier): TAnalyticsTier {
  if (cpuTier === 'low') {
    return 1;
  }
  if (cpuTier === 'high') {
    return 3;
  }
  // Keep unknown devices on the legacy medium fallback so every request uses
  // one of the three server-supported tiers.
  return 2;
}
