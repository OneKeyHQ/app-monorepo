import {
  ENotificationPermission,
  ENotificationPermissionRecoverySource,
} from '@onekeyhq/shared/types/notification';

import {
  canSendOsNotificationTest,
  enableNotificationsBestEffort,
  getOsNotificationPermissionSafe,
  isNotificationFullyEnabled,
  isOsNotificationPermissionPending,
  recoverOsNotificationPermission,
  resolveOsNotificationPermissionAction,
} from './notificationPermissionUtils';

import type { IAppNavigation } from '../hooks/useAppNavigation';

const mockFetchServerNotificationSettingsWithCache: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();
const mockUpdateServerNotificationSettings: jest.Mock<
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
const mockCheckNotificationPermissionRecovery: jest.Mock<
  Promise<unknown>,
  unknown[]
> = jest.fn();

const mockPlatformEnv: {
  isWebDappMode: boolean;
  isDesktop: boolean;
  isNative: boolean;
  isNativeIOS: boolean;
  isNativeAndroid: boolean;
} = {
  isWebDappMode: false,
  isDesktop: false,
  isNative: true,
  isNativeIOS: true,
  isNativeAndroid: false,
};

const nativePlatformCases = [
  {
    name: 'iOS',
    isNative: true,
    isNativeIOS: true,
    isNativeAndroid: false,
  },
  {
    name: 'Android',
    isNative: true,
    isNativeIOS: false,
    isNativeAndroid: true,
  },
] as const;

function applyNativePlatform(platform: (typeof nativePlatformCases)[number]) {
  mockPlatformEnv.isNative = platform.isNative;
  mockPlatformEnv.isNativeIOS = platform.isNativeIOS;
  mockPlatformEnv.isNativeAndroid = platform.isNativeAndroid;
}

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
    get isNative() {
      return mockPlatformEnv.isNative;
    },
    get isNativeIOS() {
      return mockPlatformEnv.isNativeIOS;
    },
    get isNativeAndroid() {
      return mockPlatformEnv.isNativeAndroid;
    },
  },
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNotification: {
      fetchServerNotificationSettingsWithCache: (...args: unknown[]) =>
        mockFetchServerNotificationSettingsWithCache(...args),
      updateServerNotificationSettings: (...args: unknown[]) =>
        mockUpdateServerNotificationSettings(...args),
      getPermission: (...args: unknown[]) => mockGetPermission(...args),
      getPermissionWithoutLog: (...args: unknown[]) =>
        mockGetPermissionWithoutLog(...args),
      requestPermission: (...args: unknown[]) => mockRequestPermission(...args),
      openPermissionSettings: (...args: unknown[]) =>
        mockOpenPermissionSettings(...args),
      checkNotificationPermissionRecovery: (...args: unknown[]) =>
        mockCheckNotificationPermissionRecovery(...args),
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
  it('leaves non-native platforms on Test / existing permission flow', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: denied,
        isNative: false,
      }),
    ).toBe('none');
  });

  it('requests the system prompt while authorization is still undetermined', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: undetermined,
        isNative: true,
      }),
    ).toBe('request');
  });

  it('opens Settings after the system prompt has already been denied', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: denied,
        isNative: true,
      }),
    ).toBe('openSettings');
  });

  it('hides the CTA when the OS permission is already granted', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: granted,
        isNative: true,
      }),
    ).toBe('none');
  });

  it('skips unsupported or missing permission payloads', () => {
    expect(
      resolveOsNotificationPermissionAction({
        permission: { isSupported: false, permission: denied.permission },
        isNative: true,
      }),
    ).toBe('none');
    expect(
      resolveOsNotificationPermissionAction({
        permission: undefined,
        isNative: true,
      }),
    ).toBe('none');
  });
});

describe('isOsNotificationPermissionPending', () => {
  it('does not wait for OS permission outside native', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: true,
        isNative: false,
      }),
    ).toBe(false);
  });

  it('waits while the OS permission has not been read yet', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: undefined,
        isNative: true,
      }),
    ).toBe(true);
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: true,
        isNative: true,
      }),
    ).toBe(true);
  });

  it('stops waiting once the read finishes, even if the payload is missing', () => {
    expect(
      isOsNotificationPermissionPending({
        permission: undefined,
        isLoading: false,
        isNative: true,
      }),
    ).toBe(false);
    expect(
      isOsNotificationPermissionPending({
        permission: undetermined,
        isLoading: true,
        isNative: true,
      }),
    ).toBe(false);
  });
});

describe.each(nativePlatformCases)(
  'getOsNotificationPermissionSafe ($name)',
  (platform) => {
    beforeEach(() => {
      mockGetPermissionWithoutLog.mockReset();
      mockPlatformEnv.isDesktop = false;
      applyNativePlatform(platform);
    });

    it('reads OS permission', async () => {
      mockGetPermissionWithoutLog.mockResolvedValue(granted);

      await expect(getOsNotificationPermissionSafe()).resolves.toEqual(granted);
      expect(mockGetPermissionWithoutLog).toHaveBeenCalledTimes(1);
    });

    it('returns undefined instead of throwing when the provider cannot report permission', async () => {
      mockGetPermissionWithoutLog.mockRejectedValue(new Error('unsupported'));

      await expect(getOsNotificationPermissionSafe()).resolves.toBeUndefined();
    });
  },
);

describe('getOsNotificationPermissionSafe non-native', () => {
  it('does not query OS permission outside native', async () => {
    mockGetPermissionWithoutLog.mockReset();
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isNativeAndroid = false;
    mockPlatformEnv.isDesktop = true;

    await expect(getOsNotificationPermissionSafe()).resolves.toBeUndefined();
    expect(mockGetPermissionWithoutLog).not.toHaveBeenCalled();
  });
});

const expectedRegistrationCheck = {
  ignoreCooldown: true,
  source: ENotificationPermissionRecoverySource.settings,
};

describe.each(nativePlatformCases)(
  'recoverOsNotificationPermission ($name)',
  (platform) => {
    beforeEach(() => {
      mockGetPermissionWithoutLog.mockReset();
      mockRequestPermission.mockReset();
      mockOpenPermissionSettings.mockReset();
      mockCheckNotificationPermissionRecovery.mockReset();
      mockCheckNotificationPermissionRecovery.mockResolvedValue(undefined);
      mockPlatformEnv.isWebDappMode = false;
      mockPlatformEnv.isDesktop = false;
      applyNativePlatform(platform);
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
      expect(mockCheckNotificationPermissionRecovery).not.toHaveBeenCalled();
    });

    it('opens Settings when the OS permission is already denied', async () => {
      mockOpenPermissionSettings.mockResolvedValue(undefined);
      mockGetPermissionWithoutLog.mockResolvedValue(denied);

      await expect(recoverOsNotificationPermission(denied)).resolves.toEqual(
        denied,
      );
      expect(mockRequestPermission).not.toHaveBeenCalled();
      expect(mockOpenPermissionSettings).toHaveBeenCalledTimes(1);
      expect(mockCheckNotificationPermissionRecovery).not.toHaveBeenCalled();
    });

    it('is a no-op when the permission is already granted', async () => {
      await expect(recoverOsNotificationPermission(granted)).resolves.toEqual(
        granted,
      );
      expect(mockRequestPermission).not.toHaveBeenCalled();
      expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
      expect(mockCheckNotificationPermissionRecovery).not.toHaveBeenCalled();
    });

    it('checks permission recovery after a successful grant without a pushEnabled snapshot', async () => {
      mockRequestPermission.mockResolvedValue(granted);

      await expect(
        recoverOsNotificationPermission(undetermined),
      ).resolves.toEqual(granted);
      expect(mockCheckNotificationPermissionRecovery).toHaveBeenCalledTimes(1);
      expect(mockCheckNotificationPermissionRecovery).toHaveBeenCalledWith(
        expectedRegistrationCheck,
      );
    });

    it('checks permission recovery after Settings returns granted', async () => {
      mockOpenPermissionSettings.mockResolvedValue(undefined);
      mockGetPermissionWithoutLog.mockResolvedValue(granted);

      await expect(recoverOsNotificationPermission(denied)).resolves.toEqual(
        granted,
      );
      expect(mockCheckNotificationPermissionRecovery).toHaveBeenCalledWith(
        expectedRegistrationCheck,
      );
    });

    it('keeps the granted result if the registration check rejects', async () => {
      mockRequestPermission.mockResolvedValue(granted);
      mockCheckNotificationPermissionRecovery.mockRejectedValue(
        new Error('register failed'),
      );

      await expect(
        recoverOsNotificationPermission(undetermined),
      ).resolves.toEqual(granted);
    });
  },
);

describe('recoverOsNotificationPermission non-native', () => {
  it('does not request or register outside native', async () => {
    mockRequestPermission.mockReset();
    mockCheckNotificationPermissionRecovery.mockReset();
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isNativeAndroid = false;

    await expect(
      recoverOsNotificationPermission(undetermined),
    ).resolves.toEqual(undetermined);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockCheckNotificationPermissionRecovery).not.toHaveBeenCalled();
  });
});

describe.each(nativePlatformCases)(
  'canSendOsNotificationTest ($name)',
  (platform) => {
    beforeEach(() => {
      mockGetPermissionWithoutLog.mockReset();
      mockRequestPermission.mockReset();
      mockOpenPermissionSettings.mockReset();
      mockCheckNotificationPermissionRecovery.mockReset();
      mockCheckNotificationPermissionRecovery.mockResolvedValue(undefined);
      mockPlatformEnv.isWebDappMode = false;
      mockPlatformEnv.isDesktop = false;
      applyNativePlatform(platform);
    });

    it('sends the test without prompting when the OS permission is granted', async () => {
      mockGetPermissionWithoutLog.mockResolvedValue(granted);

      await expect(canSendOsNotificationTest()).resolves.toBe(true);
      expect(mockRequestPermission).not.toHaveBeenCalled();
      expect(mockCheckNotificationPermissionRecovery).not.toHaveBeenCalled();
    });

    it('requests permission then sends the test if the user grants it', async () => {
      mockGetPermissionWithoutLog.mockResolvedValue(undetermined);
      mockRequestPermission.mockResolvedValue(granted);

      await expect(canSendOsNotificationTest()).resolves.toBe(true);
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
      expect(mockCheckNotificationPermissionRecovery).toHaveBeenCalledWith(
        expectedRegistrationCheck,
      );
    });

    it('does not send the test when the user leaves the system prompt denied', async () => {
      mockGetPermissionWithoutLog.mockResolvedValue(undetermined);
      mockRequestPermission.mockResolvedValue(denied);

      await expect(canSendOsNotificationTest()).resolves.toBe(false);
      expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
      expect(mockCheckNotificationPermissionRecovery).not.toHaveBeenCalled();
    });

    it('still allows the test if the registration check rejects after grant', async () => {
      mockGetPermissionWithoutLog.mockResolvedValue(undetermined);
      mockRequestPermission.mockResolvedValue(granted);
      mockCheckNotificationPermissionRecovery.mockRejectedValue(
        new Error('register failed'),
      );

      await expect(canSendOsNotificationTest()).resolves.toBe(true);
    });
  },
);

describe('canSendOsNotificationTest non-native', () => {
  it('keeps the existing Test behavior outside native', async () => {
    mockGetPermissionWithoutLog.mockReset();
    mockRequestPermission.mockReset();
    mockCheckNotificationPermissionRecovery.mockReset();
    mockPlatformEnv.isNative = false;
    mockPlatformEnv.isNativeIOS = false;
    mockPlatformEnv.isNativeAndroid = false;
    mockPlatformEnv.isDesktop = true;
    mockGetPermissionWithoutLog.mockResolvedValue(undetermined);

    await expect(canSendOsNotificationTest()).resolves.toBe(true);
    expect(mockGetPermissionWithoutLog).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockCheckNotificationPermissionRecovery).not.toHaveBeenCalled();
  });
});

describe('isNotificationFullyEnabled', () => {
  beforeEach(() => {
    mockFetchServerNotificationSettingsWithCache.mockReset();
    mockGetPermission.mockReset();
    mockPlatformEnv.isWebDappMode = false;
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeIOS = true;
    mockPlatformEnv.isNativeAndroid = false;
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

describe('notification setup on the Prime gift success page', () => {
  const pushModal = jest.fn();
  const navigation = { pushModal } as unknown as IAppNavigation;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isDesktop = false;
    mockPlatformEnv.isNative = true;
    mockPlatformEnv.isNativeIOS = true;
    mockPlatformEnv.isNativeAndroid = false;
    mockFetchServerNotificationSettingsWithCache.mockResolvedValue({
      pushEnabled: false,
      accountActivityPushEnabled: true,
    });
    mockGetPermission.mockResolvedValue(undetermined);
    mockRequestPermission.mockResolvedValue(denied);
    mockUpdateServerNotificationSettings.mockResolvedValue({
      pushEnabled: true,
      accountActivityPushEnabled: true,
    });
  });

  it('preserves notification settings and stays on the success page after an OS denial', async () => {
    await enableNotificationsBestEffort({
      navigation,
      stayOnCurrentPage: true,
    });
    expect(mockUpdateServerNotificationSettings).toHaveBeenCalledWith({
      pushEnabled: true,
      accountActivityPushEnabled: true,
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
    expect(pushModal).not.toHaveBeenCalled();
  });

  it('keeps an optional notification failure from failing the gift flow', async () => {
    mockRequestPermission.mockRejectedValueOnce(
      new Error('permission provider unavailable'),
    );
    await expect(
      enableNotificationsBestEffort({ navigation, stayOnCurrentPage: true }),
    ).resolves.toBeUndefined();
    expect(mockOpenPermissionSettings).not.toHaveBeenCalled();
    expect(pushModal).not.toHaveBeenCalled();
  });

  it('defers missing server settings without overwriting defaults or leaving success', async () => {
    mockFetchServerNotificationSettingsWithCache.mockResolvedValue({});
    await enableNotificationsBestEffort({
      navigation,
      stayOnCurrentPage: true,
    });
    expect(mockUpdateServerNotificationSettings).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(pushModal).not.toHaveBeenCalled();
  });

  it('abandons notification setup when the recipient is no longer current', async () => {
    await enableNotificationsBestEffort({
      navigation,
      stayOnCurrentPage: true,
      shouldContinue: () => false,
    });
    expect(mockUpdateServerNotificationSettings).not.toHaveBeenCalled();
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(pushModal).not.toHaveBeenCalled();
  });
});
