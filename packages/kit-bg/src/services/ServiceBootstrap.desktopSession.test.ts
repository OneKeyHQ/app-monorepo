import 'fake-indexeddb/auto';

import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { EPasswordVerifyStatus } from '@onekeyhq/shared/types/password';

import localDb from '../dbs/local/localDb';
import {
  passwordAtom,
  passwordAtomInitialValue,
  passwordPersistAtom,
} from '../states/jotai/atoms/passwordLock';
import { jotaiDefaultStore } from '../states/jotai/utils/jotaiDefaultStore';

import ServiceBootstrap from './ServiceBootstrap';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isExtension: false,
    isNative: false,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      bootstrap: {
        initCriticalDone: jest.fn(),
        initCriticalStart: jest.fn(),
        initCriticalStep: jest.fn(),
      },
    },
  },
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    clearHyperLiquidAgentSecretSession: jest.fn(),
    readyDb: Promise.resolve(),
    restoreHyperLiquidAgentSecretSession: jest.fn(),
  },
}));

jest.mock(
  './ServiceIdentityExit/recoverInterruptedIdentityLifecycleOperations',
  () => ({
    recoverInterruptedIdentityLifecycleOperations: jest.fn(
      async () => undefined,
    ),
  }),
);

jest.mock('./ServiceIdentityExit/identityLifecycleMutex', () => ({
  markIdentityRecoveryFailed: jest.fn(),
  markIdentityRecoveryReady: jest.fn(),
}));

jest.mock('./walletProfileAnalyticsScheduler', () => ({
  scheduleWalletProfileAnalyticsChecks: jest.fn(),
}));

describe('ServiceBootstrap Desktop app session restore', () => {
  const originalDesktopApiProxyDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'desktopApiProxy',
  );

  const buildService = () => {
    const service = Object.create(
      ServiceBootstrap.prototype,
    ) as ServiceBootstrap;
    service.backgroundApi = {
      serviceHardware: {
        migrateExistingDeviceConnectProtocols: jest.fn(async () => undefined),
      },
      serviceSetting: {
        initSystemLocale: jest.fn(async () => undefined),
        refreshLocaleMessages: jest.fn(async () => undefined),
      },
    } as unknown as ServiceBootstrap['backgroundApi'];
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jotaiDefaultStore.set(passwordAtom.atom(), {
      passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
      unLock: false,
    });
    jest.spyOn(passwordAtom, 'set').mockImplementation(async (update) => {
      jotaiDefaultStore.set(passwordAtom.atom(), update);
    });
    jest.spyOn(passwordPersistAtom, 'get').mockResolvedValue({
      ...passwordAtomInitialValue,
      appLockDuration: Number(ELockDuration.Never),
      isPasswordSet: true,
    });
    jest
      .spyOn(localDb, 'restoreHyperLiquidAgentSecretSession')
      .mockResolvedValue({ restored: false, unlocked: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalDesktopApiProxyDescriptor) {
      Object.defineProperty(
        globalThis,
        'desktopApiProxy',
        originalDesktopApiProxyDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'desktopApiProxy');
    }
  });

  it('keeps Never unlocked after renderer reload without an HLE session', async () => {
    const getAppSessionUnlocked = jest.fn(async () => true);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        security: { getAppSessionUnlocked },
      } as unknown as typeof globalThis.desktopApiProxy,
    });

    await buildService().initCritical();

    expect(getAppSessionUnlocked).toHaveBeenCalledTimes(1);
    expect(jotaiDefaultStore.get(passwordAtom.atom()).unLock).toBe(true);
  });

  it('stays locked when a new Desktop process has no unlocked session', async () => {
    const getAppSessionUnlocked = jest.fn(async () => undefined);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        security: { getAppSessionUnlocked },
      } as unknown as typeof globalThis.desktopApiProxy,
    });

    await buildService().initCritical();

    expect(getAppSessionUnlocked).toHaveBeenCalledTimes(1);
    expect(jotaiDefaultStore.get(passwordAtom.atom()).unLock).toBe(false);
  });

  it('restores the Desktop app session when HLE restoration fails', async () => {
    const getAppSessionUnlocked = jest.fn(async () => true);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        security: { getAppSessionUnlocked },
      } as unknown as typeof globalThis.desktopApiProxy,
    });
    jest
      .spyOn(localDb, 'restoreHyperLiquidAgentSecretSession')
      .mockRejectedValue(new Error('HLE restore failed'));

    await buildService().initCritical();

    expect(jotaiDefaultStore.get(passwordAtom.atom()).unLock).toBe(true);
  });
});
