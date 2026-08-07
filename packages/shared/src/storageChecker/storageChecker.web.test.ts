import storageChecker from './storageChecker';

// Web wallet mode: not an extension, not desktop, and `isWebDappMode` false.
// It persists through the same browser quota, so it must be able to clear its
// own guard — otherwise a raised guard survives until the page reloads.
jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isWebDappMode: false,
    isExtension: false,
    isDesktop: false,
    isWeb: true,
  },
  ERuntimeRole: {
    Main: 'main',
    Background: 'background',
    Standalone: 'standalone',
  },
}));

const GB = 1024 * 1024 * 1024;

function mockEstimate(quotaBytes: number, usageBytes: number) {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      storage: {
        estimate: jest.fn().mockResolvedValue({
          quota: quotaBytes,
          usage: usageBytes,
        }),
      },
    },
    configurable: true,
    writable: true,
  });
}

describe('storageChecker in web wallet mode', () => {
  beforeEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
  });

  afterEach(() => {
    globalThis.$onekeySystemDiskIsFull = undefined;
    jest.restoreAllMocks();
  });

  it('measures quota and raises the guard', async () => {
    mockEstimate(40 * GB, 40 * GB - 0.5 * GB);

    await storageChecker.checkIfDiskIsFull();

    expect(globalThis.$onekeySystemDiskIsFull).toBe(true);
  });

  it('can clear a raised guard once headroom recovers', async () => {
    globalThis.$onekeySystemDiskIsFull = true;
    mockEstimate(40 * GB, 10 * GB);

    await storageChecker.checkIfDiskIsFull();

    expect(globalThis.$onekeySystemDiskIsFull).toBeUndefined();
  });
});
