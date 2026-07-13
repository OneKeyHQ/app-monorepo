import {
  EDeviceCpuTier,
  EDeviceMemoryClass,
} from '@onekeyhq/shared/src/performance/devicePerformanceTierTypes';

import {
  ETabPreloadMode,
  resolveTabPreloadDecision,
} from './preloadPolicyResolver';

describe('resolveTabPreloadDecision', () => {
  it('disables preloading when memory is constrained regardless of CPU', () => {
    expect(
      resolveTabPreloadDecision({
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
      resolveTabPreloadDecision({
        cpuTier: EDeviceCpuTier.low,
        memoryClass: EDeviceMemoryClass.large,
      }).mode,
    ).toBe(ETabPreloadMode.disabled);
  });

  it('fully preloads for a high-tier CPU when memory is not constrained', () => {
    expect(
      resolveTabPreloadDecision({
        cpuTier: EDeviceCpuTier.high,
        memoryClass: EDeviceMemoryClass.standard,
      }).mode,
    ).toBe(ETabPreloadMode.full);
  });

  it('caps high-tier devices at light preloading on limited surfaces', () => {
    expect(
      resolveTabPreloadDecision({
        cpuTier: EDeviceCpuTier.high,
        memoryClass: EDeviceMemoryClass.large,
        allowFullPreload: false,
      }),
    ).toEqual({
      mode: ETabPreloadMode.light,
      reason: 'surface-limited',
    });
  });

  it.each([EDeviceCpuTier.medium, EDeviceCpuTier.unknown])(
    'uses light preloading for a %s CPU when memory is not constrained',
    (cpuTier) => {
      expect(
        resolveTabPreloadDecision({
          cpuTier,
          memoryClass: EDeviceMemoryClass.large,
        }).mode,
      ).toBe(ETabPreloadMode.light);
    },
  );
});
