/* eslint-disable import/first */
import type {
  IIdentityExitPlan,
  IIdentityExitPlanId,
  IIdentityExitReceipt,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import ServiceDevSetting from './ServiceDevSetting';
import {
  identityLifecycleMutex,
  resetIdentityRecoveryStateForTest,
} from './ServiceIdentityExit/identityLifecycleMutex';

import type { IDevSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

let mockSettings: IDevSettingsPersistAtom;
const mockSetSettings = jest.fn(
  async (
    update: (previous: IDevSettingsPersistAtom) => IDevSettingsPersistAtom,
  ) => {
    mockSettings = update(mockSettings);
  },
);
const mockClearEmailSessions = jest.fn<Promise<void>, []>();
const mockPrepareExit = jest.fn<Promise<IIdentityExitPlan>, [unknown]>();
const mockExecuteExit = jest.fn<Promise<IIdentityExitReceipt>, [unknown]>();
const mockRestart = jest.fn();
const mockUnregister = jest.fn<Promise<void>, []>();
const mockAuthState = jest.fn<Promise<'loggedIn' | 'loggedOut'>, []>();
const mockBumpRevision = jest.fn<Promise<number>, []>();

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/analytics', () => ({
  analytics: { init: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/appCrypto', () => ({
  __esModule: true,
  default: { pbkdf2: { setPbkdf2NativeBackend: jest.fn() } },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  buildServiceEndpoint: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/request/requestHelper', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
}));
jest.mock('@onekeyhq/shared/src/modules/NetworkThrottle', () => ({
  __esModule: true,
  default: {},
  setNetworkThrottleRuntimeConfig: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  BundleUpdate: {},
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isDesktop: false, isJest: true },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: { syncStorage: { set: jest.fn() } },
}));
jest.mock(
  '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance',
  () => ({ devSettingSyncStorage: { set: jest.fn() } }),
);
jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: async () => mockSettings,
    set: (
      update: (previous: IDevSettingsPersistAtom) => IDevSettingsPersistAtom,
    ) => mockSetSettings(update),
  },
  firmwareUpdateDevSettingsPersistAtom: { set: jest.fn() },
}));
jest.mock('./ServicePrime/primeAuthSessionAccess', () => ({
  clearEmailAuthSessionsForEnvironmentChange: () => mockClearEmailSessions(),
}));

const readyPlan: IIdentityExitPlan = {
  status: 'ready',
  planId: 'environment-logout' as IIdentityExitPlanId,
  expiresAt: Number.MAX_SAFE_INTEGER,
  presentation: { type: 'oneKeyIdOnly' },
  confirmation: { type: 'normal' },
};
const completedReceipt: IIdentityExitReceipt = {
  status: 'completed',
  oneKeyIdLoggedOut: true,
};
function createService() {
  return new ServiceDevSetting({
    backgroundApi: {
      serviceIdentityExit: {
        prepareIdentityExit: mockPrepareExit,
        executeIdentityExit: mockExecuteExit,
      },
      serviceNotification: { unregisterClient: mockUnregister },
      serviceApp: { restartApp: mockRestart },
      simpleDb: {
        prime: {
          getOneKeyIdAuthState: mockAuthState,
          getAuthSessionSource: async () => undefined,
          bumpIdentityLifecycleRevision: mockBumpRevision,
        },
      },
    },
  });
}

describe('OneKey ID environment switching', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetIdentityRecoveryStateForTest('ready');
    mockSettings = { enabled: true, settings: { enableTestEndpoint: true } };
    mockPrepareExit.mockResolvedValue(readyPlan);
    mockExecuteExit.mockResolvedValue(completedReceipt);
    mockClearEmailSessions.mockResolvedValue();
    mockUnregister.mockResolvedValue();
    mockAuthState.mockResolvedValue('loggedOut');
    mockBumpRevision.mockResolvedValue(2);
  });
  afterEach(() => {
    resetIdentityRecoveryStateForTest('ready');
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test.each(['prod-to-test', 'test-to-prod', 'disable-dev'] as const)(
    '%s logs out on the old endpoint before switching and restarting',
    async (transition) => {
      const service = createService();
      const wasTest = transition !== 'prod-to-test';
      mockSettings.settings = { enableTestEndpoint: wasTest };
      mockExecuteExit.mockImplementationOnce(async () => {
        expect(mockSettings.settings?.enableTestEndpoint).toBe(wasTest);
        expect(mockSetSettings).not.toHaveBeenCalled();
        return completedReceipt;
      });
      if (transition === 'disable-dev') await service.switchDevMode(false);
      else await service.updateDevSetting('enableTestEndpoint', !wasTest);
      expect(mockPrepareExit).toHaveBeenCalledWith({
        type: 'logoutOneKeyId',
        scene: 'devSettings',
      });
      expect(mockClearEmailSessions).toHaveBeenCalledTimes(1);
      expect(mockBumpRevision).toHaveBeenCalledTimes(1);
      expect(mockClearEmailSessions.mock.invocationCallOrder[0]).toBeLessThan(
        mockSetSettings.mock.invocationCallOrder[0],
      );
      expect(
        Boolean(
          mockSettings.enabled && mockSettings.settings?.enableTestEndpoint,
        ),
      ).toBe(!wasTest);
      expect(mockRestart).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(300);
      expect(mockRestart).toHaveBeenCalledTimes(1);
    },
  );

  test('does not log out when the effective endpoint stays unchanged', async () => {
    const service = createService();
    await service.updateDevSetting('enableTestEndpoint', true);
    await service.updateDevSetting('enableAnalyticsRequest', true);
    expect(mockPrepareExit).not.toHaveBeenCalled();
    expect(mockClearEmailSessions).not.toHaveBeenCalled();
    await jest.runOnlyPendingTimersAsync();
    expect(mockRestart).not.toHaveBeenCalled();
  });

  test.each(['prod-to-test', 'test-to-prod', 'disable-dev'] as const)(
    '%s still restarts after a committed switch fails to invalidate old login work',
    async (transition) => {
      const service = createService();
      const wasTest = transition !== 'prod-to-test';
      mockSettings.settings = { enableTestEndpoint: wasTest };
      const switchNode = () =>
        transition === 'disable-dev'
          ? service.switchDevMode(false)
          : service.updateDevSetting('enableTestEndpoint', !wasTest);
      mockBumpRevision.mockRejectedValueOnce(
        new Error('revision storage unavailable'),
      );

      await expect(switchNode()).rejects.toThrow(
        'revision storage unavailable',
      );
      expect(
        Boolean(
          mockSettings.enabled && mockSettings.settings?.enableTestEndpoint,
        ),
      ).toBe(!wasTest);
      expect(mockRestart).not.toHaveBeenCalled();

      // Retrying the committed node takes the unchanged-endpoint path, but
      // must not lose the pending restart.
      await switchNode();
      expect(mockBumpRevision).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(300);
      expect(mockRestart).toHaveBeenCalledTimes(1);
    },
  );

  test('blocks stale login commits until restart when revision invalidation fails', async () => {
    mockBumpRevision.mockRejectedValueOnce(
      new Error('revision storage unavailable'),
    );
    await expect(createService().switchDevMode(false)).rejects.toThrow(
      'revision storage unavailable',
    );
    const staleLoginCommit = jest.fn();
    await expect(
      identityLifecycleMutex.runExclusive(staleLoginCommit),
    ).rejects.toThrow('Identity recovery did not complete');
    expect(staleLoginCommit).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(300);
    expect(mockRestart).toHaveBeenCalledTimes(1);
  });

  test('clears stale endpoint sessions even when OneKey ID is already logged out', async () => {
    mockPrepareExit.mockResolvedValueOnce({
      status: 'completed',
      receipt: completedReceipt,
    });
    await createService().switchDevMode(false);
    expect(mockExecuteExit).not.toHaveBeenCalled();
    expect(mockClearEmailSessions).toHaveBeenCalledTimes(1);
  });

  test('keeps the old endpoint when logout fails', async () => {
    mockExecuteExit.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(createService().switchDevMode(false)).rejects.toThrow(
      'storage unavailable',
    );
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(mockClearEmailSessions).not.toHaveBeenCalled();
    await jest.runOnlyPendingTimersAsync();
    expect(mockRestart).not.toHaveBeenCalled();
  });

  test('does not remove a linked Keyless wallet to switch nodes', async () => {
    mockPrepareExit.mockResolvedValueOnce({
      ...readyPlan,
      confirmation: { type: 'keylessRemovalAcknowledgement' },
    });
    await expect(
      createService().updateDevSetting('enableTestEndpoint', false),
    ).rejects.toThrow('Keyless wallet');
    expect(mockExecuteExit).not.toHaveBeenCalled();
    expect(mockClearEmailSessions).not.toHaveBeenCalled();
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  test('does not switch when clearing a previously used target session fails', async () => {
    mockClearEmailSessions.mockRejectedValueOnce(
      new Error('session removal failed'),
    );
    await expect(createService().switchDevMode(false)).rejects.toThrow(
      'session removal failed',
    );
    expect(mockSetSettings).not.toHaveBeenCalled();
    await jest.runOnlyPendingTimersAsync();
    expect(mockRestart).not.toHaveBeenCalled();
  });

  test('does not clear a login that completed between logout and the environment commit', async () => {
    mockAuthState.mockResolvedValueOnce('loggedIn');
    await expect(createService().switchDevMode(false)).rejects.toThrow(
      'OneKey ID changed during logout',
    );
    expect(mockClearEmailSessions).not.toHaveBeenCalled();
    expect(mockSetSettings).not.toHaveBeenCalled();
  });

  test('serializes rapid node toggles and schedules only one restart', async () => {
    const service = createService();
    let releaseLogout!: (receipt: IIdentityExitReceipt) => void;
    let notifyLogoutStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      notifyLogoutStarted = resolve;
    });
    mockExecuteExit.mockImplementationOnce(() => {
      notifyLogoutStarted();
      return new Promise((resolve) => {
        releaseLogout = resolve;
      });
    });
    const toProd = service.updateDevSetting('enableTestEndpoint', false);
    const backToTest = service.updateDevSetting('enableTestEndpoint', true);
    await started;
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(mockPrepareExit).toHaveBeenCalledTimes(1);
    releaseLogout(completedReceipt);
    await Promise.all([toProd, backToTest]);
    expect(mockPrepareExit).toHaveBeenCalledTimes(2);
    expect(mockSettings.settings?.enableTestEndpoint).toBe(true);
    expect(mockBumpRevision).toHaveBeenCalledTimes(2);
    await jest.runOnlyPendingTimersAsync();
    expect(mockRestart).toHaveBeenCalledTimes(1);
  });
});
