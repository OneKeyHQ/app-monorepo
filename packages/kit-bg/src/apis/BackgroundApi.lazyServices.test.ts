const mockBootstrapInit = jest.fn();
const mockDemoConstructor = jest.fn();
const mockDemoGetPlatformEnv = jest.fn(async () => ({ platform: 'test' }));
const mockUnifoldConstructor = jest.fn();
const mockUnifoldTrackingLoop = jest.fn(async () => undefined);
let mockDemoModuleLoadCount = 0;
let mockUnifoldModuleLoadCount = 0;

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
        INTERNAL_demoGetPlatformEnv: async () => mockDemoGetPlatformEnv(),
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
      };
    },
  };
});

describe('BackgroundApi lazy services', () => {
  test('loads and constructs each service only when a method is called', async () => {
    const { default: BackgroundApi } = await import('./BackgroundApi');
    const backgroundApi = new BackgroundApi();

    expect(mockDemoModuleLoadCount).toBe(0);
    expect(mockUnifoldModuleLoadCount).toBe(0);
    expect(mockDemoConstructor).not.toHaveBeenCalled();
    expect(mockUnifoldConstructor).not.toHaveBeenCalled();

    const demoService = backgroundApi.serviceDemo;
    const service = backgroundApi.serviceUnifoldDeposit;
    expect(backgroundApi.serviceDemo).toBe(demoService);
    expect(backgroundApi.serviceUnifoldDeposit).toBe(service);
    expect(mockDemoModuleLoadCount).toBe(0);
    expect(mockUnifoldModuleLoadCount).toBe(0);

    await (
      demoService as unknown as {
        INTERNAL_demoGetPlatformEnv: () => Promise<unknown>;
      }
    ).INTERNAL_demoGetPlatformEnv();
    await service.unifoldDepositTrackingLoop();
    await (
      service as unknown as {
        INTERNAL_unifoldDepositTrackingLoop: () => Promise<void>;
      }
    ).INTERNAL_unifoldDepositTrackingLoop();

    expect(mockDemoModuleLoadCount).toBe(1);
    expect(mockUnifoldModuleLoadCount).toBe(1);
    expect(mockDemoConstructor).toHaveBeenCalledTimes(1);
    expect(mockDemoConstructor).toHaveBeenCalledWith({
      backgroundApi,
    });
    expect(mockUnifoldConstructor).toHaveBeenCalledTimes(1);
    expect(mockUnifoldConstructor).toHaveBeenCalledWith({
      backgroundApi,
    });
    expect(mockDemoGetPlatformEnv).toHaveBeenCalledTimes(1);
    expect(mockUnifoldTrackingLoop).toHaveBeenCalledTimes(2);
  });
});
