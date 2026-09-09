import {
  HIGH_LOGICAL_PROCESSOR_MIN,
  LOW_LOGICAL_PROCESSOR_MAX,
  resolveLogicalProcessorCpuTier,
} from './deviceCpuTierUtils';
import { EDeviceCpuTier } from './devicePerformanceTierTypes';

describe('resolveLogicalProcessorCpuTier', () => {
  it.each([
    [1, EDeviceCpuTier.low],
    [LOW_LOGICAL_PROCESSOR_MAX, EDeviceCpuTier.low],
    [LOW_LOGICAL_PROCESSOR_MAX + 1, EDeviceCpuTier.medium],
    [HIGH_LOGICAL_PROCESSOR_MIN - 1, EDeviceCpuTier.medium],
    [HIGH_LOGICAL_PROCESSOR_MIN, EDeviceCpuTier.high],
    [16, EDeviceCpuTier.high],
  ])('classifies %s logical processors as %s', (count, expectedTier) => {
    expect(resolveLogicalProcessorCpuTier(count)).toBe(expectedTier);
  });

  it.each([undefined, null, 0, -1, 4.5, Number.NaN, '8'])(
    'does not classify invalid logical processor count %s',
    (count) => {
      expect(resolveLogicalProcessorCpuTier(count)).toBeNull();
    },
  );
});
