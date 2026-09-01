const mockLoadOrder: string[] = [];

let mockResolveExecutorInstalled: (() => void) | undefined;
const mockExecutorInstalled = new Promise<void>((resolve) => {
  mockResolveExecutorInstalled = resolve;
});

jest.mock('@onekeyhq/shared/src/polyfills', () => ({}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Info: 'info' },
    NativeLogger: { write: jest.fn() },
  }),
);

jest.mock('react-native', () => ({
  AppRegistry: { registerComponent: jest.fn() },
  Platform: { OS: 'ios' },
}));

jest.mock('./setupBackgroundThreadRPCHandler', () => {
  mockLoadOrder.push('handler');
  return {
    reportBackgroundThreadInitializationFailure: jest.fn(),
    setBackgroundThreadRequestExecutor: jest.fn(() => {
      mockLoadOrder.push('executor');
      mockResolveExecutorInstalled?.();
    }),
  };
});

jest.mock('@onekeyhq/shared/src/storage/nativeStorageExecutor', () => {
  mockLoadOrder.push('storage');
  return {
    prepareNativeStorageForBackgroundStartup: jest.fn(async () => undefined),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  mockLoadOrder.push('business');
  return {
    __esModule: true,
    default: {
      bridgeReceiveHandler: jest.fn(),
      callBackgroundMethod: jest.fn(),
    },
  };
});

describe('background entry initialization order', () => {
  it('installs the RPC handler before storage preparation and business modules', async () => {
    jest.isolateModules(() => {
      require('../../background');
    });

    await mockExecutorInstalled;

    expect(mockLoadOrder).toEqual([
      'handler',
      'storage',
      'business',
      'executor',
    ]);
  });
});
