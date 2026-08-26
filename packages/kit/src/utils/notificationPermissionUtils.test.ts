import { ENotificationPermission } from '@onekeyhq/shared/types/notification';

import {
  canSendOsNotificationTest,
  getOsNotificationPermissionSafe,
  isNotificationFullyEnabled,
  isOsNotificationPermissionPending,
  recoverOsNotificationPermission,
  resolveOsNotificationPermissionAction,
} from './notificationPermissionUtils';

const mockFetchServerNotificationSettingsWithCache: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();
const mockGetPermission: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();
const mockGetPermissionWithoutLog: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();
const mockRequestPermission: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();
const mockOpenPermissionSettings: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();

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
      getPermissionWithoutLog: (...args: unknown[]) =>
        mockGetPermissionWithoutLog(...args),
      requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
      openPermissionSettings: (...args: unknown[]) =>
        mockOpenPermissionSettings(...args),
    },
  },
}));

const granted = {
  isSupported: true,
  permission: ENotificationPermission.granted,
};
const undetermined = {
  isSupported: true,
  permission: ENotificationPermission.default,
};
const denied = {
  isSupported: true,
  permission: ENotificationPermission.denied,
};

describe('resolveOsNotificationPermissionAction', () => {
  it('requests the system prompt while authorization is still undetermined', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: undetermined,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe('request');
  });

  it('opens Settings after the system prompt has already been denied', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: denied,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe('openSettings');
  });

  it('hides the CTA when the OS permission is already granted', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: granted,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe('none');
  });

  it('ignores the unknowable desktop permission even when it reports default', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: undetermined,
        isDesktop: true,
        isWebDappMode: false,
      }),
    ).toBe('none');
  });

  it('skips web dapp mode and unsupported or missing permission payloads', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: denied,
        isDesktop: false,
        isWebDappMode: true,
      }),
    ).toBe('none');
    expect(
      resolveOsNotificationPermissionAction({
        permission: { isSupported: false, permission: denied.permission },
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe('none');
    expect(
      resolveOsNotificationPermissionAction({
        permission: undefined,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe('none');
  });
});

describe('isOsNotificationPermissionPending', () => {
  it('waits while the OS permission has not been read yet', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: undefined,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe(true);
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: true,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe(true);
  });

  it('stops waiting once the read finishes, even if the payload is missing', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: false,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe(false);
    expect(
      isOsNotificationPermissionPending({
        permission: undetermined,
        isLoading: true,
        isDesktop: false,
        isWebDappMode: false,
      }),
    ).toBe(false);
  });

  it('does not wait on desktop or web dapp mode, where the CTA is always Test', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: true,
        isDesktop: true,
        isWebDappMode: false,
      }),
    ).toBe(false);
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: true,
        isDesktop: false,
        isWebDappMode: true,
      }),
    ).toBe(false);
  });
});

describe('getOsNotificationPermissionSafe', () => {
  beforeEach(() => {
    mockGetPermissionWithoutLog.mockReset();
  });

  it('returns undefined instead of throwing when the provider cannot report permission', async () => {
    mockGetPermissionWithoutLog.mockRejectedValue(new Error('unsupported'));

    await expect(getOsNotificationPermissionSafe()).resolves.toBeUndefined();
  });
});

describe('recoverOsNotificationPermission', () => {
  beforeEach(() => {
    mockGetPermissionWithoutLog.mockReset();
    mockRequestPermission.mockReset();
    mockOpenPermissionSettings.mockReset();
    mockPlatformEnv.isWebDappMode = false;
    mockPlatformEnv.isDesktop = false;
  });

  it('only requests authorization when the OS status is still undetermined', async () => {
    mockRequestPermission.mockResolvedValue(granted);

    await expect(
      recoverOsNotificationPermission(undetermined),
    ).resolves.toEqual(granted);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
  });

  it('does not open Settings if the user denies the first system prompt', async () => {
    mockRequestPermission.mockResolvedValue(denied);

    await expect(
      recoverOsNotificationPermission(undetermined),
    ).resolves.toEqual(denied);
    expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
  });

  it('opens Settings when the OS permission is already denied', async () => {
    mockOpenPermissionSettings.mockResolvedValue(undefined);
    mockGetPermissionWithoutLog.mockResolvedValue(denied);

    await expect(recoverOsNotificationPermission(denied)).resolves.toEqual(
      denied,
    );
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockOpenPermissionSettings).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the permission is already granted', async () => {
    await expect(recoverOsNotificationPermission(granted)).resolves.toEqual(
      granted,
    );
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
  });
});

describe('canSendOsNotificationTest', () => {
  beforeEach(() => {
    mockGetPermissionWithoutLog.mockReset();
    mockRequestPermission.mockReset();
    mockOpenPermissionSettings.mockReset();
    mockPlatformEnv.isWebDappMode = false;
    mockPlatformEnv.isDesktop = false;
  });

  it('sends the test without prompting when the OS permission is granted', async () => {
    mockGetPermissionWithoutLog.mockResolvedValue(granted);

    await expect(canSendOsNotificationTest()).resolves.toBe(true);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('requests permission then sends the test if the user grants it', async () => {
    mockGetPermissionWithoutLog.mockResolvedValue(undetermined);
    mockRequestPermission.mockResolvedValue(granted);

    await expect(canSendOsNotificationTest()).resolves.toBe(true);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not send the test when the user leaves the system prompt denied', async () => {
    mockGetPermissionWithoutLog.mockResolvedValue(undetermined);
    mockRequestPermission.mockResolvedValue(denied);

    await expect(canSendOsNotificationTest()).resolves.toBe(false);
    expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
  });

  it('still sends the test on desktop where OS permission cannot be resolved', async () => {
    mockPlatformEnv.isDesktop = true;
    mockGetPermissionWithoutLog.mockResolvedValue(undetermined);

    await expect(canSendOsNotificationTest()).resolves.toBe(true);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

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
