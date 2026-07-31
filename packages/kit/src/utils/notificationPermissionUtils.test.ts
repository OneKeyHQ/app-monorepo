import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import { isNotificationFullyEnabled } from './notificationPermissionUtils';

const mockFetchServerNotificationSettingsWithCache: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();
const mockGetPermission: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();

const mockPlatformEnv: { isWebDappMode: boolean; isDesktop: boolean } = {
  isWebDappMode: false,
  isDesktop: false,
};

// Factories must reference the mocks lazily: they run while the module under
// test is being imported, before the const initializers above execute.
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isWebDappMode() {
      return mockPlatformEnv.isWebDappMode;
    },
    get isDesktop() {
      return mockPlatformEnv.isDesktop;
    },
  },
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      fetchServerNotificationSettingsWithCache: (...args: unknown[]) =>
        mockFetchServerNotificationSettingsWithCache(...args),
      getPermission: (...args: unknown[]) => mockGetPermission(...args),
    },
  },
}));

describe('isNotificationFullyEnabled', () => {
  beforeEach(() => {
    mockFetchServerNotificationSettingsWithCache.mockReset();
    mockGetPermission.mockReset();
    mockPlatformEnv.isWebDappMode = false;
    mockPlatformEnv.isDesktop = false;
  });

  it('returns false when the master switch is off', async () => {
    mockFetchServerNotificationSettingsWithCache.mockResolvedValue({
      pushEnabled: false,
    });

    await expect(isNotificationFullyEnabled()).resolves.toBe(false);
    expect(mockGetPermission).not.toHaveBeenCalled();
  });

  it('returns false when the system permission is missing on platforms reporting a real value', async () => {
    mockFetchServerNotificationSettingsWithCache.mockResolvedValue({
      pushEnabled: true,
    });
    mockGetPermission.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.default,
    });

    await expect(isNotificationFullyEnabled()).resolves.toBe(false);
  });

  it('returns true when the master switch is on and the permission is granted', async () => {
    mockFetchServerNotificationSettingsWithCache.mockResolvedValue({
      pushEnabled: true,
    });
    mockGetPermission.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.granted,
    });

    await expect(isNotificationFullyEnabled()).resolves.toBe(true);
  });

  it('ignores the unknowable system permission on desktop', async () => {
    // The desktop notification provider cannot resolve the real OS permission
    // and always reports `default`; the master switch alone must decide there.
    mockPlatformEnv.isDesktop = true;
    mockFetchServerNotificationSettingsWithCache.mockResolvedValue({
      pushEnabled: true,
    });
    mockGetPermission.mockResolvedValue({
      isSupported: true,
      permission: ENotificationPermission.default,
    });

    await expect(isNotificationFullyEnabled()).resolves.toBe(true);
  });
});
