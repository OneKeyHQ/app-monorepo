import { getDeviceMemoryGBSync } from './getMemorySync.desktop';

describe('getDeviceMemoryGBSync on desktop', () => {
  const originalDesktopApiDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApi',
  );
  const originalDeviceMemoryDescriptor = Object.getOwnPropertyDescriptor(
    globalThis.navigator,
    'deviceMemory',
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
    if (originalDeviceMemoryDescriptor) {
      Object.defineProperty(
        globalThis.navigator,
        'deviceMemory',
        originalDeviceMemoryDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis.navigator, 'deviceMemory');
    }
  });

  it('uses exact physical memory from the desktop bridge', () => {
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: { totalMemoryBytes: 16 * 1024 ** 3 },
    });

    expect(getDeviceMemoryGBSync()).toBe(16);
  });

  it('falls back to browser memory when the bridge value is invalid', () => {
    Object.defineProperty(globalThis, 'desktopApi', {
      configurable: true,
      value: { totalMemoryBytes: 0 },
    });
    Object.defineProperty(globalThis.navigator, 'deviceMemory', {
      configurable: true,
      value: 4,
    });

    expect(getDeviceMemoryGBSync()).toBe(4);
  });
});
