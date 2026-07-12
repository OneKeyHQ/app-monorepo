import {
  resolveDevicePerformanceProfile,
  resolveMemoryClass,
} from './devicePerformanceTierResolver';
import {
  EDeviceCpuTier,
  EDeviceMemoryClass,
} from './devicePerformanceTierTypes';

describe('devicePerformanceTierResolver', () => {
  it.each([
    [null, false, EDeviceMemoryClass.unknown],
    [3.5, true, EDeviceMemoryClass.constrained],
    [3.55, false, EDeviceMemoryClass.standard],
    [6, false, EDeviceMemoryClass.standard],
    [8, false, EDeviceMemoryClass.large],
  ])('classifies %sGB memory', (memoryGB, isMemoryConstrained, expected) => {
    expect(resolveMemoryClass({ memoryGB, isMemoryConstrained })).toBe(
      expected,
    );
  });

  it('classifies Motorola One 5G UW ace as low despite 3.55GB RAM', () => {
    const profile = resolveDevicePerformanceProfile({
      cpuTierMatch: {
        tier: EDeviceCpuTier.low,
        source: 'androidModel',
        confidence: 'medium',
      },
      memoryGB: 3.55,
      isMemoryConstrained: false,
    });

    expect(profile.cpu.tier).toBe(EDeviceCpuTier.low);
    expect(profile.memory.class).toBe(EDeviceMemoryClass.standard);
  });

  it('keeps iPhone 17 Pro in the high tier without startup-time input', () => {
    const profile = resolveDevicePerformanceProfile({
      cpuTierMatch: {
        tier: EDeviceCpuTier.high,
        source: 'iosModelId',
        confidence: 'high',
      },
      memoryGB: 8,
      isMemoryConstrained: false,
    });

    expect(profile.cpu.tier).toBe(EDeviceCpuTier.high);
    expect(profile.memory.class).toBe(EDeviceMemoryClass.large);
  });

  it('never promotes an unknown high-memory device to high', () => {
    const profile = resolveDevicePerformanceProfile({
      cpuTierMatch: null,
      memoryGB: 12,
      isMemoryConstrained: false,
    });

    expect(profile.cpu.tier).toBe(EDeviceCpuTier.unknown);
    expect(profile.memory.class).toBe(EDeviceMemoryClass.large);
  });

  it('keeps CPU and constrained memory as independent capabilities', () => {
    const profile = resolveDevicePerformanceProfile({
      cpuTierMatch: {
        tier: EDeviceCpuTier.high,
        source: 'androidModel',
        confidence: 'medium',
      },
      memoryGB: 3.5,
      isMemoryConstrained: true,
    });

    expect(profile.cpu.tier).toBe(EDeviceCpuTier.high);
    expect(profile.memory.class).toBe(EDeviceMemoryClass.constrained);
  });

  it('applies a developer override only to CPU capability', () => {
    const profile = resolveDevicePerformanceProfile({
      cpuTierMatch: null,
      memoryGB: null,
      isMemoryConstrained: false,
      overrideCpuTier: EDeviceCpuTier.high,
    });

    expect(profile.cpu.tier).toBe(EDeviceCpuTier.high);
    expect(profile.cpu.source).toBe('developerOverride');
    expect(profile.memory.class).toBe(EDeviceMemoryClass.unknown);
  });
});
