import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceBootstrap from './ServiceBootstrap';
import { markIdentityRecoveryReady } from './ServiceIdentityExit/identityLifecycleMutex';
import { recoverInterruptedIdentityLifecycleOperations } from './ServiceIdentityExit/recoverInterruptedIdentityLifecycleOperations';

const mockInstallRequestBlackout = jest.fn();
const mockStartServerTimeInterval = jest.fn();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: false,
    isExtension: false,
    isNative: true,
    isWeb: false,
  },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  setTravelModePushSuppressed: jest.fn(async () => undefined),
  travelModeManager: {
    getRuntimeEnvironmentSync: jest.fn(() => ({
      persistence: {
        runSync: <T>({ operation }: { operation: () => T }) => operation(),
      },
    })),
    getRuntimeProfile: jest.fn(async () => ({
      dappRequests: 'blocked',
      kind: 'travel-mode',
      persistence: 'masked',
      walletEffects: 'suppressed',
    })),
    isMaskingDataSync: jest.fn(() => true),
  },
}));

jest.mock('../apis/TravelModeDappRequestIngress', () => ({
  travelModeDappRequestIngress: {
    installRequestBlackout: () => {
      mockInstallRequestBlackout();
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      bootstrap: {
        initCriticalDone: jest.fn(),
        initCriticalStart: jest.fn(),
        initCriticalStep: jest.fn(),
        initDeferredDone: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: {
    startServerTimeInterval: () => {
      mockStartServerTimeInterval();
    },
  },
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    readyDb: Promise.resolve(),
  },
}));

jest.mock('./ServiceIdentityExit/identityLifecycleMutex', () => ({
  markIdentityRecoveryFailed: jest.fn(),
  markIdentityRecoveryReady: jest.fn(),
}));

jest.mock(
  './ServiceIdentityExit/recoverInterruptedIdentityLifecycleOperations',
  () => ({
    recoverInterruptedIdentityLifecycleOperations: jest.fn(
      async () => undefined,
    ),
  }),
);

jest.mock('./walletProfileAnalyticsScheduler', () => ({
  scheduleWalletProfileAnalyticsChecks: jest.fn(),
}));

describe('ServiceBootstrap Travel Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs only critical control-plane startup in Travel Mode', async () => {
    const service = Object.create(
      ServiceBootstrap.prototype,
    ) as ServiceBootstrap;
    const initSystemLocale = jest.fn(async () => undefined);
    const refreshLocaleMessages = jest.fn(async () => undefined);
    const unexpectedServiceAccess = jest.fn();
    const controlPlane = {
      serviceSetting: {
        initSystemLocale,
        refreshLocaleMessages,
      },
    };
    service.backgroundApi = new Proxy(controlPlane, {
      get: (target, property) => {
        if (property === 'serviceSetting') {
          return target.serviceSetting;
        }
        unexpectedServiceAccess(property);
        throw new OneKeyLocalError(
          `Unexpected Travel Mode service access: ${String(property)}`,
        );
      },
    }) as unknown as ServiceBootstrap['backgroundApi'];

    await service.initCritical();

    expect(initSystemLocale).toHaveBeenCalledTimes(1);
    expect(refreshLocaleMessages).toHaveBeenCalledTimes(1);
    expect(markIdentityRecoveryReady).toHaveBeenCalledTimes(1);
    expect(
      recoverInterruptedIdentityLifecycleOperations,
    ).not.toHaveBeenCalled();
    expect(unexpectedServiceAccess).not.toHaveBeenCalled();
  });

  it('skips WalletConnect construction and normal deferred initialization', async () => {
    const service = Object.create(
      ServiceBootstrap.prototype,
    ) as ServiceBootstrap;
    const initIpTable = jest.fn(async () => undefined);
    const fetchInscriptionProtectionControl = jest.fn(async () => undefined);
    const fetchReviewControl = jest.fn(async () => undefined);
    service.backgroundApi = {
      serviceIpTable: {
        init: initIpTable,
      },
      serviceSetting: {
        fetchInscriptionProtectionControl,
        fetchReviewControl,
      },
    } as unknown as ServiceBootstrap['backgroundApi'];
    Object.defineProperty(service.backgroundApi, 'walletConnect', {
      get: () => {
        throw new OneKeyLocalError(
          'WalletConnect must not be constructed in Travel Mode',
        );
      },
    });

    await service.initDeferred();

    expect(mockInstallRequestBlackout).toHaveBeenCalledTimes(1);
    expect(initIpTable).not.toHaveBeenCalled();
    expect(fetchInscriptionProtectionControl).not.toHaveBeenCalled();
    expect(fetchReviewControl).not.toHaveBeenCalled();
    expect(mockStartServerTimeInterval).not.toHaveBeenCalled();
  });
});
