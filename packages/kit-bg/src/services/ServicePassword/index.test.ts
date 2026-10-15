import ServicePassword, { shouldUseV4MigrationPasswordForPrompt } from '.';

import { encodeSensitiveTextAsync } from '@onekeyhq/core/src/secret';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { WrongPassword } from '@onekeyhq/shared/src/errors';
import { checkBiometricAuthChanged } from '@onekeyhq/shared/src/modules3rdParty/check-biometric-auth-changed';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import {
  RuntimeEnvironment,
  getTravelModeRuntimeProfile,
  travelModeManager,
} from '@onekeyhq/shared/src/travelMode';
import { ENCODE_TEXT_PREFIX } from '@onekeyhq/shared/src/utils/sensitiveTextUtils';
import {
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import localDb from '../../dbs/local/localDb';
import { runtimePersistenceAdapter } from '../../runtime/RuntimeEnvironmentAdapter';
import { firmwareUpdateWorkflowRunningAtom } from '../../states/jotai/atoms/hardware';
import { passwordBiologyAuthInfoAtom } from '../../states/jotai/atoms/password';
import {
  appIsLocked,
  hyperLiquidAgentPasswordStatusAtom,
  passwordAtom,
  passwordAtomInitialValue,
  passwordPersistAtom,
  passwordPersistManualLockStateAtom,
} from '../../states/jotai/atoms/passwordLock';
import { settingsLastActivityAtom } from '../../states/jotai/atoms/settings';
import { v4migrationAtom } from '../../states/jotai/atoms/v4migration';
import { jotaiDefaultStore } from '../../states/jotai/utils/jotaiDefaultStore';

import { biologyAuthUtils } from './biologyAuthUtils';

const PASSWORD_VALIDATION_PROBE_ID =
  'password-validation-explicit-webcrypto-test';

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/check-biometric-auth-changed',
  () => ({ checkBiometricAuthChanged: jest.fn() }),
);

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    clearHyperLiquidAgentSecretSession: jest.fn(),
    isHyperLiquidAgentSecretSessionReady: jest.fn(),
    isPasswordSet: jest.fn(),
    restoreHyperLiquidAgentSecretSession: jest.fn(),
    setHyperLiquidAgentSecretSessionUnlocked: jest.fn(),
    setPassword: jest.fn(),
    unlockHyperLiquidAgentSecretSession: jest.fn(),
    verifyPassword: jest.fn(),
  },
}));

describe('ServicePassword', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest
      .spyOn(localDb, 'isHyperLiquidAgentSecretSessionReady')
      .mockReturnValue(false);
    jest.spyOn(localDb, 'isPasswordSet').mockResolvedValue(false);
    jest
      .spyOn(localDb, 'restoreHyperLiquidAgentSecretSession')
      .mockResolvedValue({ restored: false, unlocked: false });
    jotaiDefaultStore.set(passwordPersistAtom.atom(), {
      ...passwordAtomInitialValue,
      appLockDuration: Number(ELockDuration.Never),
      isPasswordSet: false,
    });
    jotaiDefaultStore.set(passwordAtom.atom(), {
      passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
      unLock: false,
    });
    jotaiDefaultStore.set(hyperLiquidAgentPasswordStatusAtom.atom(), {
      isPasswordSet: false,
      requiresPasswordSetupOrVerify: true,
    });
    jotaiDefaultStore.set(passwordPersistManualLockStateAtom.atom(), {
      manualLocking: false,
    });
    const migrationState = jotaiDefaultStore.get(v4migrationAtom.atom());
    jotaiDefaultStore.set(v4migrationAtom.atom(), {
      ...migrationState,
      isMigrationModalOpen: false,
      isProcessing: false,
    });
    jest
      .spyOn(passwordPersistAtom, 'set')
      .mockImplementation(async (update) => {
        jotaiDefaultStore.set(passwordPersistAtom.atom(), update);
      });
    jest
      .spyOn(passwordPersistAtom, 'get')
      .mockImplementation(async () =>
        jotaiDefaultStore.get(passwordPersistAtom.atom()),
      );
    jest.spyOn(passwordAtom, 'set').mockImplementation(async (update) => {
      jotaiDefaultStore.set(passwordAtom.atom(), update);
    });
    jest
      .spyOn(hyperLiquidAgentPasswordStatusAtom, 'set')
      .mockImplementation(async (update) => {
        jotaiDefaultStore.set(
          hyperLiquidAgentPasswordStatusAtom.atom(),
          update,
        );
      });
    jest
      .spyOn(passwordPersistManualLockStateAtom, 'get')
      .mockImplementation(async () =>
        jotaiDefaultStore.get(passwordPersistManualLockStateAtom.atom()),
      );
    jest
      .spyOn(passwordPersistManualLockStateAtom, 'set')
      .mockImplementation(async (update) => {
        jotaiDefaultStore.set(
          passwordPersistManualLockStateAtom.atom(),
          update,
        );
      });
  });

  it('never substitutes a migration password for a manual prompt', () => {
    expect(
      shouldUseV4MigrationPasswordForPrompt({
        isProcessing: true,
        manualPasswordOnly: true,
      }),
    ).toBe(false);
    expect(
      shouldUseV4MigrationPasswordForPrompt({
        isProcessing: true,
        manualPasswordOnly: false,
      }),
    ).toBe(true);
  });

  it('enforces persisted password cooldown in background while persistence is masked', async () => {
    jest
      .spyOn(runtimePersistenceAdapter, 'isUnavailable')
      .mockReturnValue(true);
    jotaiDefaultStore.set(passwordPersistAtom.atom(), {
      ...passwordAtomInitialValue,
      isPasswordSet: true,
      passwordErrorAttempts: 4,
      passwordErrorProtectionTime: 0,
    });
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    const validatePassword = jest
      .spyOn(servicePassword, 'validatePassword')
      .mockRejectedValue(new WrongPassword());
    const password = await encodeSensitiveTextAsync({
      text: 'wrong-passcode',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });
    const params = {
      password,
      passwordMode: EPasswordMode.PASSCODE,
      skipPostVerifyBackgroundTasks: true,
    };

    await expect(servicePassword.verifyPassword(params)).rejects.toThrow(
      'WrongPassword',
    );
    const protectedState = jotaiDefaultStore.get(passwordPersistAtom.atom());
    expect(protectedState.passwordErrorAttempts).toBe(5);
    expect(protectedState.passwordErrorProtectionTime).toBeGreaterThan(
      Date.now(),
    );

    await expect(servicePassword.verifyPassword(params)).rejects.toThrow(
      'Unknown error',
    );
    expect(validatePassword).toHaveBeenCalledTimes(1);
  });

  it('uses caller-provided KDF parameters when validating password rules', async () => {
    if (!appCrypto.pbkdf2.isWebCryptoPbkdf2Supported()) {
      return;
    }

    const password = await encodeSensitiveTextAsync({
      text: 'test-password',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });
    appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(
      PASSWORD_VALIDATION_PROBE_ID,
    );
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;

    await servicePassword.validatePasswordValidRules({
      password,
      passwordMode: EPasswordMode.PASSWORD,
      skipLengthCheck: true,
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
      debugCryptoProbeId: PASSWORD_VALIDATION_PROBE_ID,
    } as Parameters<ServicePassword['validatePasswordValidRules']>[0] & {
      debugCryptoProbeId: string;
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });

    expect(
      appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(
        PASSWORD_VALIDATION_PROBE_ID,
      )?.backend,
    ).toBe('webcrypto');
  });

  it('defers legacy passcode-mode repair while persistence is masked', async () => {
    const verifyPassword = jest.spyOn(localDb, 'verifyPassword');
    const password = await encodeSensitiveTextAsync({
      text: '123456',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    jest
      .spyOn(servicePassword, 'validatePasswordValidRules')
      .mockResolvedValue({ shouldFixPasscodeMode: true });
    jest
      .spyOn(runtimePersistenceAdapter, 'isUnavailable')
      .mockReturnValue(true);
    const setPasswordState = jest.spyOn(passwordPersistAtom, 'set');
    setPasswordState.mockClear();

    await servicePassword.validatePassword({
      password,
      passwordMode: EPasswordMode.PASSWORD,
      skipLazyUpgrade: true,
    });

    expect(verifyPassword).toHaveBeenCalledWith({
      password,
      skipLazyUpgrade: true,
    });
    expect(setPasswordState).not.toHaveBeenCalled();
  });

  it('preserves normal password verification work when only post-verify tasks are skipped', async () => {
    jest
      .spyOn(runtimePersistenceAdapter, 'isUnavailable')
      .mockReturnValue(false);
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    const updateClientBasicAppInfoDebounced = jest.fn();
    servicePassword.backgroundApi = {
      serviceNotification: { updateClientBasicAppInfoDebounced },
    } as unknown as ServicePassword['backgroundApi'];
    const validatePassword = jest
      .spyOn(servicePassword, 'validatePassword')
      .mockResolvedValue(undefined);
    const unlockHyperLiquidAgentSecretSession = jest
      .spyOn(localDb, 'unlockHyperLiquidAgentSecretSession')
      .mockResolvedValue(undefined);
    const setCachedPassword = jest
      .spyOn(servicePassword, 'setCachedPassword')
      .mockImplementation(async ({ password }) => password);
    const refreshHyperLiquidAgentPasswordStatus = jest
      .spyOn(servicePassword, 'refreshHyperLiquidAgentPasswordStatus')
      .mockResolvedValue({
        isPasswordSet: true,
        requiresPasswordSetupOrVerify: false,
      });
    const runPostPasswordVerifyBackgroundTasks = jest
      .spyOn(servicePassword, 'runPostPasswordVerifyBackgroundTasks')
      .mockResolvedValue(undefined);
    const password = await encodeSensitiveTextAsync({
      text: 'test-password',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });

    await expect(
      servicePassword.verifyPassword({
        password,
        passwordMode: EPasswordMode.PASSCODE,
        skipPostVerifyBackgroundTasks: true,
      }),
    ).resolves.toBe(password);

    expect(validatePassword).toHaveBeenCalledWith({
      password,
      passwordMode: EPasswordMode.PASSCODE,
      kdfBackend: undefined,
      enablePbkdf2Cache: undefined,
      skipLazyUpgrade: false,
    });
    expect(unlockHyperLiquidAgentSecretSession).toHaveBeenCalledTimes(1);
    expect(setCachedPassword).toHaveBeenCalledWith({
      password,
    });
    expect(refreshHyperLiquidAgentPasswordStatus).toHaveBeenCalledTimes(1);
    expect(updateClientBasicAppInfoDebounced).toHaveBeenCalledTimes(1);
    expect(runPostPasswordVerifyBackgroundTasks).not.toHaveBeenCalled();
  });

  it('skips persistence-dependent password work while Travel Mode is active', async () => {
    jest
      .spyOn(runtimePersistenceAdapter, 'isUnavailable')
      .mockReturnValue(true);
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    const updateClientBasicAppInfoDebounced = jest.fn();
    servicePassword.backgroundApi = {
      serviceNotification: { updateClientBasicAppInfoDebounced },
    } as unknown as ServicePassword['backgroundApi'];
    const validatePassword = jest
      .spyOn(servicePassword, 'validatePassword')
      .mockResolvedValue(undefined);
    const unlockHyperLiquidAgentSecretSession = jest.spyOn(
      localDb,
      'unlockHyperLiquidAgentSecretSession',
    );
    const setCachedPassword = jest
      .spyOn(servicePassword, 'setCachedPassword')
      .mockImplementation(async ({ password }) => password);
    const refreshHyperLiquidAgentPasswordStatus = jest.spyOn(
      servicePassword,
      'refreshHyperLiquidAgentPasswordStatus',
    );
    const runPostPasswordVerifyBackgroundTasks = jest.spyOn(
      servicePassword,
      'runPostPasswordVerifyBackgroundTasks',
    );
    const password = await encodeSensitiveTextAsync({
      text: 'test-password',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });

    await expect(
      servicePassword.verifyPassword({
        password,
        passwordMode: EPasswordMode.PASSCODE,
      }),
    ).resolves.toBe(password);

    expect(validatePassword).toHaveBeenCalledWith({
      password,
      passwordMode: EPasswordMode.PASSCODE,
      kdfBackend: undefined,
      enablePbkdf2Cache: undefined,
      skipLazyUpgrade: true,
    });
    expect(unlockHyperLiquidAgentSecretSession).not.toHaveBeenCalled();
    expect(setCachedPassword).toHaveBeenCalledWith({
      password,
      skipBackgroundTasks: true,
    });
    expect(refreshHyperLiquidAgentPasswordStatus).not.toHaveBeenCalled();
    expect(updateClientBasicAppInfoDebounced).not.toHaveBeenCalled();
    expect(runPostPasswordVerifyBackgroundTasks).not.toHaveBeenCalled();
  });

  it('does not expose a locked state while setting the initial password', async () => {
    expect(platformEnv.isNative).toBe(false);

    const dispatchUnlockJob = jest.fn().mockResolvedValue(undefined);
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    servicePassword.backgroundApi = {
      serviceApp: { dispatchUnlockJob },
    } as unknown as ServicePassword['backgroundApi'];
    jest
      .spyOn(servicePassword, 'validatePassword')
      .mockResolvedValue(undefined);
    jest
      .spyOn(servicePassword, 'saveBiologyAuthPassword')
      .mockResolvedValue(undefined);
    jest
      .spyOn(servicePassword, 'setCachedPassword')
      .mockImplementation(async ({ password }) => password);

    let isLockedDuringPasswordPersistence: boolean | undefined;
    jest.spyOn(localDb, 'setPassword').mockImplementation(async () => {
      isLockedDuringPasswordPersistence = jotaiDefaultStore.get(
        appIsLocked.atom(),
      );
    });
    const initializeSessionMock = jest.spyOn(
      localDb,
      'unlockHyperLiquidAgentSecretSession',
    );
    const markSessionUnlockedMock = jest.spyOn(
      localDb,
      'setHyperLiquidAgentSecretSessionUnlocked',
    );

    const password = await encodeSensitiveTextAsync({
      text: 'test-password',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });
    await servicePassword.setPassword(password, EPasswordMode.PASSWORD);

    expect(isLockedDuringPasswordPersistence).toBe(false);
    expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(false);

    const initializeSessionOrder =
      initializeSessionMock.mock.invocationCallOrder[0];
    const markSessionUnlockedOrder =
      markSessionUnlockedMock.mock.invocationCallOrder[0];
    expect(initializeSessionOrder).toBeLessThan(markSessionUnlockedOrder);
    expect(dispatchUnlockJob).toHaveBeenCalledTimes(1);
  });

  it('does not let a concurrent password check persist a stale result', async () => {
    const dispatchUnlockJob = jest.fn().mockResolvedValue(undefined);
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    servicePassword.backgroundApi = {
      serviceApp: { dispatchUnlockJob },
    } as unknown as ServicePassword['backgroundApi'];
    jest
      .spyOn(servicePassword, 'validatePassword')
      .mockResolvedValue(undefined);
    jest
      .spyOn(servicePassword, 'saveBiologyAuthPassword')
      .mockResolvedValue(undefined);
    jest
      .spyOn(servicePassword, 'setCachedPassword')
      .mockImplementation(async ({ password }) => password);

    let isPasswordSetInDb = false;
    let notifyPasswordWriteStarted!: () => void;
    const passwordWriteStarted = new Promise<void>((resolve) => {
      notifyPasswordWriteStarted = resolve;
    });
    let allowPasswordWriteToFinish!: () => void;
    const passwordWriteCanFinish = new Promise<void>((resolve) => {
      allowPasswordWriteToFinish = resolve;
    });
    jest.spyOn(localDb, 'setPassword').mockImplementation(async () => {
      notifyPasswordWriteStarted();
      await passwordWriteCanFinish;
      isPasswordSetInDb = true;
    });
    jest
      .spyOn(localDb, 'isPasswordSet')
      .mockImplementation(async () => isPasswordSetInDb);

    const password = await encodeSensitiveTextAsync({
      text: 'test-password',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });
    const setPasswordPromise = servicePassword.setPassword(
      password,
      EPasswordMode.PASSWORD,
    );
    await passwordWriteStarted;

    const checkPasswordSetPromise = servicePassword.checkPasswordSet();
    allowPasswordWriteToFinish();

    const [, checkPasswordSetResult] = await Promise.all([
      setPasswordPromise,
      checkPasswordSetPromise,
    ]);
    expect(checkPasswordSetResult).toBe(true);
    expect(
      jotaiDefaultStore.get(passwordPersistAtom.atom()).isPasswordSet,
    ).toBe(true);
  });

  it('requires password verification when neither a session nor cached password is available', async () => {
    jest.spyOn(localDb, 'isPasswordSet').mockResolvedValue(true);
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;

    await expect(
      servicePassword.refreshHyperLiquidAgentPasswordStatus(),
    ).resolves.toEqual({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: true,
    });
  });

  it('sets up the agent session before continuing after password verification', async () => {
    let isSessionReady = false;
    jest.spyOn(localDb, 'isPasswordSet').mockResolvedValue(true);
    jest
      .spyOn(localDb, 'isHyperLiquidAgentSecretSessionReady')
      .mockImplementation(() => isSessionReady);
    const unlockHyperLiquidAgentSecretSession = jest
      .spyOn(localDb, 'unlockHyperLiquidAgentSecretSession')
      .mockImplementation(async () => {
        isSessionReady = true;
      });
    const setHyperLiquidAgentSecretSessionUnlocked = jest.spyOn(
      localDb,
      'setHyperLiquidAgentSecretSessionUnlocked',
    );
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    const promptPasswordVerify = jest
      .spyOn(servicePassword, 'promptPasswordVerify')
      .mockResolvedValue({ password: 'encoded-password' });

    await expect(
      servicePassword.promptHyperLiquidAgentPasswordSetupOrVerify(),
    ).resolves.toEqual({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: false,
    });

    expect(promptPasswordVerify).toHaveBeenCalledWith({
      reason: EReasonForNeedPassword.Security,
    });
    expect(unlockHyperLiquidAgentSecretSession).toHaveBeenCalledWith({
      migrateCredentials: false,
      password: 'encoded-password',
      skipWhenNoCredentials: false,
    });
    expect(setHyperLiquidAgentSecretSessionUnlocked).toHaveBeenCalledWith(true);
  });

  it('does not require another password prompt after the password cache expires while the agent session remains ready', async () => {
    jest.spyOn(localDb, 'isPasswordSet').mockResolvedValue(true);
    jest
      .spyOn(localDb, 'isHyperLiquidAgentSecretSessionReady')
      .mockReturnValue(true);
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;

    await expect(
      servicePassword.refreshHyperLiquidAgentPasswordStatus(),
    ).resolves.toEqual({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: false,
    });
  });

  it('marks the Desktop process session unlocked after app unlock', async () => {
    const originalIsDesktop = platformEnv.isDesktop;
    const originalDesktopApiProxyDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'desktopApiProxy',
    );
    const setAppSessionUnlocked = jest.fn(
      async (_unlocked: boolean) => undefined,
    );
    platformEnv.isDesktop = true;
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        security: { setAppSessionUnlocked },
      } as unknown as typeof globalThis.desktopApiProxy,
    });
    const dispatchUnlockJob = jest.fn(async () => undefined);
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    servicePassword.backgroundApi = {
      serviceApp: { dispatchUnlockJob },
    } as unknown as ServicePassword['backgroundApi'];

    try {
      await servicePassword.unLockApp();

      expect(setAppSessionUnlocked).toHaveBeenCalledWith(true);
    } finally {
      platformEnv.isDesktop = originalIsDesktop;
      if (originalDesktopApiProxyDescriptor) {
        Object.defineProperty(
          globalThis,
          'desktopApiProxy',
          originalDesktopApiProxyDescriptor,
        );
      } else {
        Reflect.deleteProperty(globalThis, 'desktopApiProxy');
      }
    }
  });

  it('marks the Desktop process session locked before app lock completes', async () => {
    const originalIsDesktop = platformEnv.isDesktop;
    const originalDesktopApiProxyDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'desktopApiProxy',
    );
    const setAppSessionUnlocked = jest.fn(
      async (_unlocked: boolean) => undefined,
    );
    platformEnv.isDesktop = true;
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        security: { setAppSessionUnlocked },
      } as unknown as typeof globalThis.desktopApiProxy,
    });
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;
    servicePassword.backgroundApi = {
      serviceV4Migration: {
        isAtMigrationPage: jest.fn(async () => false),
      },
    } as unknown as ServicePassword['backgroundApi'];
    jest.spyOn(servicePassword, 'clearCachedPassword').mockResolvedValue();
    jest
      .spyOn(firmwareUpdateWorkflowRunningAtom, 'get')
      .mockResolvedValue(false);

    try {
      await servicePassword.lockApp({ manual: false });

      expect(setAppSessionUnlocked).toHaveBeenCalledWith(false);
    } finally {
      platformEnv.isDesktop = originalIsDesktop;
      if (originalDesktopApiProxyDescriptor) {
        Object.defineProperty(
          globalThis,
          'desktopApiProxy',
          originalDesktopApiProxyDescriptor,
        );
      } else {
        Reflect.deleteProperty(globalThis, 'desktopApiProxy');
      }
    }
  });

  it.each([true, false])(
    'ignores lockApp with manual=%s in Travel Mode',
    async (manual) => {
      jest
        .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
        .mockReturnValue(
          RuntimeEnvironment.create(getTravelModeRuntimeProfile(true)),
        );
      jest
        .spyOn(runtimePersistenceAdapter, 'isUnavailable')
        .mockReturnValue(true);
      jotaiDefaultStore.set(passwordPersistAtom.atom(), {
        ...passwordAtomInitialValue,
        isPasswordSet: true,
      });
      const servicePassword = Object.create(
        ServicePassword.prototype,
      ) as ServicePassword;
      servicePassword.backgroundApi = {
        serviceV4Migration: {
          isAtMigrationPage: jest.fn(async () => false),
        },
      } as unknown as ServicePassword['backgroundApi'];
      const clearCachedPassword = jest
        .spyOn(servicePassword, 'clearCachedPassword')
        .mockResolvedValue();
      const clearAgentSecretSession = jest.spyOn(
        localDb,
        'clearHyperLiquidAgentSecretSession',
      );
      const setAgentSecretSessionUnlocked = jest.spyOn(
        localDb,
        'setHyperLiquidAgentSecretSessionUnlocked',
      );
      jest
        .spyOn(servicePassword, 'refreshHyperLiquidAgentPasswordStatus')
        .mockResolvedValue({
          isPasswordSet: false,
          requiresPasswordSetupOrVerify: false,
        });
      jest
        .spyOn(firmwareUpdateWorkflowRunningAtom, 'get')
        .mockResolvedValue(false);

      const passwordState = jotaiDefaultStore.get(passwordAtom.atom());
      const passwordSettings = jotaiDefaultStore.get(
        passwordPersistAtom.atom(),
      );

      await servicePassword.lockApp({ manual });

      expect(
        jotaiDefaultStore.get(passwordPersistManualLockStateAtom.atom()),
      ).toEqual({ manualLocking: false });
      expect(jotaiDefaultStore.get(passwordAtom.atom())).toEqual(passwordState);
      expect(jotaiDefaultStore.get(passwordPersistAtom.atom())).toEqual(
        passwordSettings,
      );
      expect(jotaiDefaultStore.get(appIsLocked.atom())).toBe(false);
      expect(clearCachedPassword).toHaveBeenCalled();
      expect(clearAgentSecretSession).not.toHaveBeenCalled();
      expect(setAgentSecretSessionUnlocked).not.toHaveBeenCalled();
    },
  );

  it('ignores lock settings changes in Travel Mode without updating password state', async () => {
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
      .mockReturnValue(
        RuntimeEnvironment.create(getTravelModeRuntimeProfile(true)),
      );
    const passwordSettings = {
      ...passwordAtomInitialValue,
      isPasswordSet: true,
      appLockDuration: Number(ELockDuration.Minute5),
      enableSystemIdleLock: true,
    };
    jotaiDefaultStore.set(passwordPersistAtom.atom(), passwordSettings);
    const passwordState = jotaiDefaultStore.get(passwordAtom.atom());
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;

    await servicePassword.setAppLockDuration(Number(ELockDuration.Never));
    await servicePassword.setEnableSystemIdleLock(false);

    expect(jotaiDefaultStore.get(passwordPersistAtom.atom())).toEqual(
      passwordSettings,
    );
    expect(jotaiDefaultStore.get(passwordAtom.atom())).toEqual(passwordState);
  });

  it.each([ELockDuration.Always, ELockDuration.Minute5, ELockDuration.Never])(
    'ignores auto-lock duration %s in Travel Mode',
    async (duration) => {
      jest
        .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
        .mockReturnValue(
          RuntimeEnvironment.create(getTravelModeRuntimeProfile(true)),
        );
      jest
        .spyOn(runtimePersistenceAdapter, 'isUnavailable')
        .mockReturnValue(true);
      jotaiDefaultStore.set(passwordPersistAtom.atom(), {
        ...passwordAtomInitialValue,
        appLockDuration: Number(duration),
        isPasswordSet: true,
      });
      jest.spyOn(settingsLastActivityAtom, 'get').mockResolvedValue({
        time: Date.now() - 6 * 60 * 1000,
      });
      const servicePassword = Object.create(
        ServicePassword.prototype,
      ) as ServicePassword;
      const lockApp = jest
        .spyOn(servicePassword, 'lockApp')
        .mockResolvedValue(undefined);

      await servicePassword.checkLockStatus();

      expect(lockApp).not.toHaveBeenCalled();
    },
  );
});

describe('ServicePassword biometric check recovery', () => {
  const markerKey = 'biometricAuthCheckPending';
  let persisted: string | null;
  const originalIOS = Object.getOwnPropertyDescriptor(
    platformEnv,
    'isNativeIOS',
  );
  const setting = jest.fn<Promise<void>, [boolean]>();
  const makeService = () =>
    Object.assign(Object.create(ServicePassword.prototype) as ServicePassword, {
      backgroundApi: { serviceSetting: { setBiologyAuthSwitchOn: setting } },
    });

  beforeEach(() => {
    jest.restoreAllMocks();
    setting.mockReset().mockResolvedValue(undefined);
    persisted = null;
    jest.mocked(checkBiometricAuthChanged).mockReset();
    Object.defineProperty(platformEnv, 'isNativeIOS', {
      configurable: true,
      value: true,
    });
    jest.spyOn(biologyAuth, 'isSupportBiologyAuth').mockResolvedValue(true);
    jest
      .spyOn(appStorage, 'getItem')
      .mockImplementation(async (key) =>
        key === markerKey ? persisted : null,
      );
    jest.spyOn(appStorage, 'setItem').mockImplementation(async (key, value) => {
      if (key === markerKey) persisted = value;
    });
    jest.spyOn(appStorage, 'removeItem').mockImplementation(async (key) => {
      if (key === markerKey) persisted = null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalIOS)
      Object.defineProperty(platformEnv, 'isNativeIOS', originalIOS);
  });

  it('writes a durable checkpoint before the SDK and clears it on unchanged', async () => {
    jest.mocked(checkBiometricAuthChanged).mockImplementation(async () => {
      expect(persisted).toBe('checking');
      return false;
    });
    await expect(makeService().checkBiometricAuthChanged()).resolves.toBe(
      false,
    );
    expect(persisted).toBeNull();
    expect(setting).not.toHaveBeenCalled();
  });

  it('recovers changed state after setting failure and a new service instance', async () => {
    jest.mocked(checkBiometricAuthChanged).mockResolvedValue(true);
    setting.mockRejectedValueOnce(new Error('write failed'));
    await expect(makeService().checkBiometricAuthChanged()).rejects.toThrow(
      'write failed',
    );
    expect(persisted).toBe('changed');
    jest.mocked(checkBiometricAuthChanged).mockClear().mockResolvedValue(false);
    await expect(makeService().checkBiometricAuthChanged()).resolves.toBe(true);
    expect(checkBiometricAuthChanged).not.toHaveBeenCalled();
    expect(setting).toHaveBeenLastCalledWith(false);
    expect(persisted).toBeNull();
  });

  it('blocks an interrupted check after restart without consuming another baseline', async () => {
    persisted = 'checking';
    jest.mocked(checkBiometricAuthChanged).mockClear();
    await expect(makeService().checkBiometricAuthChanged()).rejects.toThrow();
    expect(checkBiometricAuthChanged).not.toHaveBeenCalled();
    expect(setting).not.toHaveBeenCalled();
  });

  it('does not call native code if the checkpoint cannot be written', async () => {
    jest
      .spyOn(appStorage, 'setItem')
      .mockRejectedValue(new Error('disk unavailable'));
    jest.mocked(checkBiometricAuthChanged).mockClear();
    await expect(makeService().checkBiometricAuthChanged()).rejects.toThrow(
      'disk unavailable',
    );
    expect(checkBiometricAuthChanged).not.toHaveBeenCalled();
  });

  it('retains uncertainty after SDK failure without disabling biometrics', async () => {
    jest
      .mocked(checkBiometricAuthChanged)
      .mockRejectedValue(new Error('Keychain unavailable'));
    await expect(makeService().checkBiometricAuthChanged()).rejects.toThrow(
      'Keychain unavailable',
    );
    expect(persisted).toBe('checking');
    expect(setting).not.toHaveBeenCalled();
  });
  it('coalesces overlapping checks including the settings write', async () => {
    let resolve!: (value: boolean) => void;
    jest.mocked(checkBiometricAuthChanged).mockReturnValue(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    const service = makeService();
    const first = service.checkBiometricAuthChanged();
    const second = service.checkBiometricAuthChanged();
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(checkBiometricAuthChanged).toHaveBeenCalledTimes(1);
    resolve(true);
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(setting).toHaveBeenCalledTimes(1);
  });

  it('clears uncertainty only after successful password verification', async () => {
    persisted = 'checking';
    const service = makeService();
    const verified = 'encoded-password';
    const verify = jest.spyOn(
      service as unknown as { verifyPasswordInner: () => Promise<string> },
      'verifyPasswordInner',
    );
    verify.mockRejectedValueOnce(new Error('wrong password'));
    const params = { password: verified, passwordMode: EPasswordMode.PASSWORD };
    await expect(service.verifyPassword(params)).rejects.toThrow(
      'wrong password',
    );
    expect(persisted).toBe('checking');
    verify.mockResolvedValueOnce(verified);
    await expect(service.verifyPassword(params)).resolves.toBe(verified);
    expect(persisted).toBeNull();
  });

  it('preserves password access if recovery storage is unavailable', async () => {
    persisted = 'checking';
    const service = makeService();
    jest
      .spyOn(
        service as unknown as { verifyPasswordInner: () => Promise<string> },
        'verifyPasswordInner',
      )
      .mockResolvedValue('encoded-password');
    jest
      .spyOn(appStorage, 'removeItem')
      .mockRejectedValue(new Error('disk unavailable'));
    await expect(
      service.verifyPassword({
        password: 'encoded-password',
        passwordMode: EPasswordMode.PASSWORD,
      }),
    ).resolves.toBe('encoded-password');
    expect(persisted).toBe('checking');
  });
  it('preserves a normal unchanged check and the single authentication challenge', async () => {
    const service = makeService();
    const encoded = `${ENCODE_TEXT_PREFIX.aes}test-payload`;
    jest
      .spyOn(passwordBiologyAuthInfoAtom, 'get')
      .mockResolvedValue(Promise.resolve({ authType: [], isSupport: true }));
    jest.mocked(checkBiometricAuthChanged).mockResolvedValue(false);
    const authenticate = jest
      .spyOn(biologyAuthUtils, 'biologyAuthenticate')
      .mockResolvedValue({ success: true });
    jest.spyOn(biologyAuthUtils, 'getPassword').mockResolvedValue(encoded);
    await expect(service.checkBiometricAuthChanged()).resolves.toBe(false);
    await expect(service.getBiologyAuthPassword()).resolves.toBe(encoded);
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(setting).not.toHaveBeenCalled();
    expect(persisted).toBeNull();
  });

  it('blocks direct biometric password access while recovery is pending', async () => {
    persisted = 'checking';
    const authenticate = jest.spyOn(biologyAuthUtils, 'biologyAuthenticate');
    await expect(makeService().getBiologyAuthPassword()).rejects.toThrow();
    expect(authenticate).not.toHaveBeenCalled();
  });
});
