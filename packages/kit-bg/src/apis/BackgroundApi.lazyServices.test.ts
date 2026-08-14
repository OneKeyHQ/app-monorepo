const mockBootstrapInit = jest.fn();
const mockDemoConstructor = jest.fn();
const mockDemoGetPlatformEnv = jest.fn(async () => ({ platform: 'test' }));
const mockDemoInternalGetPlatformEnv = jest.fn(async () => ({
  platform: 'internal',
}));
const mockUnifoldConstructor = jest.fn();
const mockUnifoldTrackingLoop = jest.fn(async () => undefined);
const mockUnifoldPrivateMethod = jest.fn(async () => undefined);
const mockIdentityExitConstructor = jest.fn();
const mockIdentityExitRecovery = jest.fn(async () => ({
  recoveredOperationCount: 0,
  abandonedOperationCount: 0,
}));
let mockDemoModuleLoadCount = 0;
let mockUnifoldModuleLoadCount = 0;
let mockIdentityExitModuleLoadCount = 0;

jest.mock('./BackgroundApiBase', () => ({
  __esModule: true,
  default: function BackgroundApiBase() {},
}));

jest.mock('../connectors/externalWalletFactory', () => ({
  __esModule: true,
  default: {
    setBackgroundApi: jest.fn(),
  },
}));

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    setBackgroundApi: jest.fn(),
  },
}));

jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    setBackgroundApi: jest.fn(),
  },
}));

jest.mock('../services/ServiceBootstrap', () => ({
  __esModule: true,
  default: function ServiceBootstrap() {
    return {
      init: mockBootstrapInit,
    };
  },
}));

jest.mock('../services/ServiceDemo', () => {
  mockDemoModuleLoadCount += 1;
  return {
    __esModule: true,
    default: function ServiceDemo(params: unknown) {
      mockDemoConstructor(params);
      return {
        demoGetPlatformEnv: async () => mockDemoGetPlatformEnv(),
        INTERNAL_demoGetPlatformEnv: async () =>
          mockDemoInternalGetPlatformEnv(),
      };
    },
  };
});

jest.mock('../services/ServiceUnifoldDeposit', () => {
  mockUnifoldModuleLoadCount += 1;
  return {
    __esModule: true,
    default: function ServiceUnifoldDeposit(params: unknown) {
      mockUnifoldConstructor(params);
      return {
        unifoldDepositTrackingLoop: async () => mockUnifoldTrackingLoop(),
        INTERNAL_unifoldDepositTrackingLoop: async () =>
          mockUnifoldTrackingLoop(),
        mutateTrackingState: async () => mockUnifoldPrivateMethod(),
      };
    },
  };
});

jest.mock('../services/ServiceIdentityExit/ServiceIdentityExit', () => {
  mockIdentityExitModuleLoadCount += 1;
  return {
    __esModule: true,
    default: function ServiceIdentityExit(params: unknown) {
      mockIdentityExitConstructor(params);
      return {
        recoverInterruptedIdentityExitOperations: async () =>
          mockIdentityExitRecovery(),
      };
    },
  };
});

describe('BackgroundApi lazy services', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockDemoModuleLoadCount = 0;
    mockUnifoldModuleLoadCount = 0;
    mockIdentityExitModuleLoadCount = 0;
  });

  test('loads and constructs each service only when a method is called', async () => {
    const { default: BackgroundApi } = await import('./BackgroundApi');
    const backgroundApi = new BackgroundApi();

    expect(mockDemoModuleLoadCount).toBe(0);
    expect(mockUnifoldModuleLoadCount).toBe(0);
    expect(mockIdentityExitModuleLoadCount).toBe(0);
    expect(mockDemoConstructor).not.toHaveBeenCalled();
    expect(mockUnifoldConstructor).not.toHaveBeenCalled();
    expect(mockIdentityExitConstructor).not.toHaveBeenCalled();

    const demoService = backgroundApi.serviceDemo;
    const service = backgroundApi.serviceUnifoldDeposit;
    const identityExitService = backgroundApi.serviceIdentityExit;
    expect(backgroundApi.serviceDemo).toBe(demoService);
    expect(backgroundApi.serviceUnifoldDeposit).toBe(service);
    expect(backgroundApi.serviceIdentityExit).toBe(identityExitService);
    expect(mockDemoModuleLoadCount).toBe(0);
    expect(mockUnifoldModuleLoadCount).toBe(0);
    expect(mockIdentityExitModuleLoadCount).toBe(0);

    await demoService.demoGetPlatformEnv();
    await service.unifoldDepositTrackingLoop();
    await identityExitService.recoverInterruptedIdentityExitOperations();
    await (
      service as unknown as {
        INTERNAL_unifoldDepositTrackingLoop: () => Promise<void>;
      }
    ).INTERNAL_unifoldDepositTrackingLoop();

    expect(mockDemoModuleLoadCount).toBe(1);
    expect(mockUnifoldModuleLoadCount).toBe(1);
    expect(mockIdentityExitModuleLoadCount).toBe(1);
    expect(mockDemoConstructor).toHaveBeenCalledTimes(1);
    expect(mockDemoConstructor).toHaveBeenCalledWith({
      backgroundApi,
    });
    expect(mockUnifoldConstructor).toHaveBeenCalledTimes(1);
    expect(mockUnifoldConstructor).toHaveBeenCalledWith({
      backgroundApi,
    });
    expect(mockIdentityExitConstructor).toHaveBeenCalledTimes(1);
    expect(mockIdentityExitConstructor).toHaveBeenCalledWith({
      backgroundApi,
    });
    expect(mockDemoGetPlatformEnv).toHaveBeenCalledTimes(1);
    expect(mockDemoInternalGetPlatformEnv).not.toHaveBeenCalled();
    expect(mockUnifoldTrackingLoop).toHaveBeenCalledTimes(2);
    expect(mockIdentityExitRecovery).toHaveBeenCalledTimes(1);
  });

  test('does not load for inspection properties or behave like a promise', async () => {
    const { default: BackgroundApi } = await import('./BackgroundApi');
    const backgroundApi = new BackgroundApi();
    const service = backgroundApi.serviceUnifoldDeposit as unknown as Record<
      PropertyKey,
      unknown
    >;

    expect(service.then).toBeUndefined();
    expect(service.toJSON).toBeUndefined();
    expect(Reflect.get(service, 'hasOwnProperty')).toBeUndefined();
    expect(service[Symbol.toStringTag]).toBeUndefined();
    expect(await Promise.resolve(service)).toBe(service);
    expect(mockUnifoldModuleLoadCount).toBe(0);
    expect(mockUnifoldConstructor).not.toHaveBeenCalled();
  });

  test('gates lazy local calls with the decorated alias and rejects private methods', async () => {
    const { default: BackgroundApi } = await import('./BackgroundApi');
    const { getLocalBackgroundServiceMethod } =
      await import('./lazyServiceProxy');
    const backgroundApi = new BackgroundApi();
    const service = backgroundApi.serviceUnifoldDeposit;

    const allowedMethod = getLocalBackgroundServiceMethod({
      serviceApi: service,
      methodName: 'unifoldDepositTrackingLoop',
      backgroundMethodName: 'INTERNAL_unifoldDepositTrackingLoop',
    });
    await expect(
      Reflect.apply(
        allowedMethod as (...args: unknown[]) => unknown,
        service,
        [],
      ),
    ).resolves.toBeUndefined();

    const privateMethod = getLocalBackgroundServiceMethod({
      serviceApi: service,
      methodName: 'mutateTrackingState',
      backgroundMethodName: 'INTERNAL_mutateTrackingState',
    });
    await expect(
      Reflect.apply(
        privateMethod as (...args: unknown[]) => unknown,
        service,
        [],
      ),
    ).rejects.toThrow(
      'Background method not support (method=serviceUnifoldDeposit.INTERNAL_mutateTrackingState)',
    );
    expect(mockUnifoldPrivateMethod).not.toHaveBeenCalled();
  });

  test('calls the original dev method after the lazy local gate passes', async () => {
    const { default: BackgroundApi } = await import('./BackgroundApi');
    const { getLocalBackgroundServiceMethod } =
      await import('./lazyServiceProxy');
    const backgroundApi = new BackgroundApi();
    const service = backgroundApi.serviceDemo;

    const localMethod = getLocalBackgroundServiceMethod({
      serviceApi: service,
      methodName: 'demoGetPlatformEnv',
      backgroundMethodName: 'INTERNAL_demoGetPlatformEnv',
    });
    await expect(
      Reflect.apply(
        localMethod as (...args: unknown[]) => unknown,
        service,
        [],
      ),
    ).resolves.toEqual({ platform: 'test' });
    expect(mockDemoGetPlatformEnv).toHaveBeenCalledTimes(1);
    expect(mockDemoInternalGetPlatformEnv).not.toHaveBeenCalled();
  });

  test('keeps eager services gated by the decorated alias', async () => {
    const { getLocalBackgroundServiceMethod } =
      await import('./lazyServiceProxy');
    const originalMethod = jest.fn(async () => 'result');
    const service = {
      INTERNAL_method: jest.fn(async () => 'decorated result'),
      method: originalMethod,
    };

    const serviceMethod = getLocalBackgroundServiceMethod({
      serviceApi: service,
      methodName: 'method',
      backgroundMethodName: 'INTERNAL_method',
    });
    await expect(
      Reflect.apply(
        serviceMethod as (...args: unknown[]) => unknown,
        service,
        [],
      ),
    ).resolves.toBe('result');
    expect(originalMethod).toHaveBeenCalledTimes(1);

    expect(
      getLocalBackgroundServiceMethod({
        serviceApi: { method: originalMethod },
        methodName: 'method',
        backgroundMethodName: 'INTERNAL_method',
      }),
    ).toBeUndefined();
  });
});
