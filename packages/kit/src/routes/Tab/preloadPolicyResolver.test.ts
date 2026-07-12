import {
  EDeviceCpuTier,
  EDeviceMemoryClass,
} from '@onekeyhq/shared/src/performance/devicePerformanceTierTypes';

import {
  ETabPreloadMode,
  resolveNativeTabPreloadDecision,
} from './preloadPolicyResolver';

describe('resolveNativeTabPreloadDecision', () => {
  it('disables preloading when memory is constrained regardless of CPU', () => {
    expect(
      resolveNativeTabPreloadDecision({
        cpuTier: EDeviceCpuTier.high,
        memoryClass: EDeviceMemoryClass.constrained,
      }),
    ).toEqual({
      mode: ETabPreloadMode.disabled,
      reason: 'memory-constrained',
    });
  });

  it('disables preloading for a low-tier CPU with ample memory', () => {
    expect(
      resolveNativeTabPreloadDecision({
        cpuTier: EDeviceCpuTier.low,
        memoryClass: EDeviceMemoryClass.large,
      }).mode,
    ).toBe(ETabPreloadMode.disabled);
  });

  it('fully preloads for a high-tier CPU when memory is not constrained', () => {
    expect(
      resolveNativeTabPreloadDecision({
        cpuTier: EDeviceCpuTier.high,
        memoryClass: EDeviceMemoryClass.standard,
      }).mode,
    ).toBe(ETabPreloadMode.full);
  });

  it.each([EDeviceCpuTier.medium, EDeviceCpuTier.unknown])(
    'uses light preloading for a %s CPU when memory is not constrained',
    (cpuTier) => {
      expect(
        resolveNativeTabPreloadDecision({
          cpuTier,
          memoryClass: EDeviceMemoryClass.large,
        }).mode,
      ).toBe(ETabPreloadMode.light);
    },
  );
});
