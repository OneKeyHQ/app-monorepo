import { getDeviceCpuTierMatch } from './deviceCpuTier.desktop';
import { EDeviceCpuTier } from './devicePerformanceTierTypes';

describe('getDeviceCpuTierMatch on desktop', () => {
  const originalDesktopApiDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApi',
  );
  const originalHardwareConcurrencyDescriptor = Object.getOwnPropertyDescriptor(
    globalThis.navigator,
    'hardwareConcurrency',
  );

  afterEach(() => {
    if (originalDesktopApiDescriptor) {
      Object.defineProperty(
        globalThis,
        'desktopApi',
        originalDesktopApiDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'desktopApi');
    }
    if (originalHardwareConcurrencyDescriptor) {
      Object.defineProperty(
        globalThis.navigator,
        'hardwareConcurrency',
        originalHardwareConcurrencyDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis.navigator, 'hardwareConcurrency');
    }
  });

  it('prefers the bridged logical processor count', () => {
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: { logicalProcessorCount: 4 },
    });

    expect(getDeviceCpuTierMatch()).toEqual({
      tier: EDeviceCpuTier.low,
      source: 'desktopLogicalProcessorCount',
      confidence: 'medium',
    });
  });

  it('falls back to browser concurrency when the bridge value is invalid', () => {
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: { logicalProcessorCount: 0 },
    });
    Object.defineProperty(globalThis.navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 8,
    });

    expect(getDeviceCpuTierMatch()).toEqual({
      tier: EDeviceCpuTier.high,
      source: 'browserHardwareConcurrency',
      confidence: 'medium',
    });
  });
});
