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

const mockPlatformEnv: {
  isWebDappMode: boolean;
  isDesktop: boolean;
  isNativeIOS: boolean;
} = {
  isWebDappMode: false,
  isDesktop: false,
  isNativeIOS: true,
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
    get isNativeIOS() {
      return mockPlatformEnv.isNativeIOS;
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
  it('leaves Android on its existing notification permission flow', () => {
    const androidPermissionContext = {
      permission: denied,
      isNativeIOS: false,
    };

    expect(
      resolveOsNotificationPermissionAction(androidPermissionContext),
    ).toBe('none');
  });

  it('requests the system prompt while authorization is still undetermined', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: undetermined,
        isNativeIOS: true,
      }),
    ).toBe('request');
  });

  it('opens Settings after the system prompt has already been denied', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: denied,
        isNativeIOS: true,
      }),
    ).toBe('openSettings');
  });

  it('hides the CTA when the OS permission is already granted', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: granted,
        isNativeIOS: true,
      }),
    ).toBe('none');
  });

  it('skips unsupported or missing permission payloads', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: { isSupported: false, permission: denied.permission },
        isNativeIOS: true,
      }),
    ).toBe('none');
    expect(
      resolveOsNotificationPermissionAction({
        permission: undefined,
        isNativeIOS: true,
      }),
    ).toBe('none');
  });
});

describe('isOsNotificationPermissionPending', () => {
  it('does not wait for OS permission outside iOS', () => {
    const androidPermissionContext = {
      permission: undefined,
      isLoading: true,
      isNativeIOS: false,
    };

    expect(isOsNotificationPermissionPending(androidPermissionContext)).toBe(
      false,
    );
  });

  it('waits while the OS permission has not been read yet', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: undefined,
        isNativeIOS: true,
      }),
    ).toBe(true);
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: true,
        isNativeIOS: true,
      }),
    ).toBe(true);
  });

  it('stops waiting once the read finishes, even if the payload is missing', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: false,
        isNativeIOS: true,
      }),
    ).toBe(false);
    expect(
      isOsNotificationPermissionPending({
        permission: undetermined,
        isLoading: true,
        isNativeIOS: true,
      }),
    ).toBe(false);
  });
});

describe('getOsNotificationPermissionSafe', () => {
  beforeEach(() => {
    mockGetPermissionWithoutLog.mockReset();
    mockPlatformEnv.isNativeIOS = true;
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
    mockPlatformEnv.isNativeIOS = true;
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
    mockPlatformEnv.isNativeIOS = true;
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

  it('keeps the existing Test behavior outside iOS', async () => {
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isDesktop = true;
    mockGetPermissionWithoutLog.mockResolvedValue(undetermined);

    await expect(canSendOsNotificationTest()).resolves.toBe(true);
    expect(mockGetPermissionWithoutLog).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

describe('isNotificationFullyEnabled', () => {
  beforeEach(() => {
    mockFetchServerNotificationSettingsWithCache.mockReset();
    mockGetPermission.mockReset();
    mockPlatformEnv.isWebDappMode = false;
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isNativeIOS = true;
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
