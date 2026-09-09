import type { IBackgroundThreadRequest } from './rpcProtocol';

const mockLoadOrder: string[] = [];

let mockRequestExecutor:
  | ((request: IBackgroundThreadRequest) => Promise<unknown>)
  | undefined;
const mockCallBackgroundMethod = jest.fn(async () => 'service-result');
const mockRunTransportServiceCall = jest.fn(
  async ({ operation }: { operation: () => Promise<unknown> }) => operation(),
);

let mockResolveExecutorInstalled: (() => void) | undefined;
const mockExecutorInstalled = new Promise<void>((resolve) => {
  mockResolveExecutorInstalled = resolve;
});
let mockResolveTravelModeAcknowledgement: (() => void) | undefined;
const mockTravelModeAcknowledgement = new Promise<void>((resolve) => {
  mockResolveTravelModeAcknowledgement = resolve;
});
let mockResolveBusinessLoaded: (() => void) | undefined;
const mockBusinessLoaded = new Promise<void>((resolve) => {
  mockResolveBusinessLoaded = resolve;
});

jest.mock('@onekeyhq/shared/src/polyfills', () => {
  mockLoadOrder.push('polyfills');
  return {};
});

jest.mock('@onekeyhq/shared/src/polyfills/runtimeCapabilities', () => ({
  markRuntimePolyfillsReady: jest.fn(() => {
    mockLoadOrder.push('polyfills-ready');
  }),
}));

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
    setBackgroundThreadRequestExecutor: jest.fn(
      (executor: (request: IBackgroundThreadRequest) => Promise<unknown>) => {
        mockRequestExecutor = executor;
        mockLoadOrder.push('executor');
        mockResolveExecutorInstalled?.();
      },
    ),
  };
});

jest.mock('@onekeyhq/kit-bg/src/apis/TravelModeCommandDispatcher', () => ({
  travelModeCommandDispatcher: {
    runTransportServiceCall: mockRunTransportServiceCall,
  },
}));

jest.mock('@onekeyhq/shared/src/storage/nativeStorageExecutor', () => {
  mockLoadOrder.push('storage');
  return {
    executeNativeStorageRequest: jest.fn(async () => undefined),
    prepareNativeStorageForBackgroundStartup: jest.fn(async () => undefined),
  };
});

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {},
}));

jest.mock(
  '@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement',
  () => ({
    completeTravelModeRuntimeLaunchAcknowledgement: jest.fn(async () => {
      mockLoadOrder.push('travel-mode-ack-start');
      await mockTravelModeAcknowledgement;
      mockLoadOrder.push('travel-mode-ack-complete');
      return true;
    }),
  }),
);

jest.mock('@onekeyhq/shared/src/travelMode/runtimeLaunchGate', () => ({
  installTravelModeRuntimeLaunchGate: jest.fn(() => {
    mockLoadOrder.push('gate-installed');
    return true;
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  mockLoadOrder.push('business');
  mockResolveBusinessLoaded?.();
  return {
    __esModule: true,
    default: {
      bridgeReceiveHandler: jest.fn(),
      callBackgroundMethod: mockCallBackgroundMethod,
    },
  };
});

describe('background entry initialization order', () => {
  it('installs the bootstrap-only RPC executor before acknowledgement completes or business modules load', async () => {
    jest.isolateModules(() => {
      require('../../background');
    });

    await mockExecutorInstalled;

    expect(mockLoadOrder).toEqual([
      'polyfills',
      'polyfills-ready',
      'handler',
      'storage',
      'travel-mode-ack-start',
      'gate-installed',
      'executor',
    ]);

    mockResolveTravelModeAcknowledgement?.();
    await mockBusinessLoaded;
    expect(mockLoadOrder).toEqual([
      'polyfills',
      'polyfills-ready',
      'handler',
      'storage',
      'travel-mode-ack-start',
      'gate-installed',
      'executor',
      'travel-mode-ack-complete',
      'business',
    ]);

    mockRunTransportServiceCall.mockRejectedValueOnce(
      new Error('Unknown error'),
    );
    await expect(
      mockRequestExecutor?.({
        type: 'service-call',
        method: 'serviceFutureFeature.runFutureCommand',
        params: [],
        sync: false,
      }),
    ).rejects.toThrow('Unknown error');
    expect(mockRunTransportServiceCall).toHaveBeenCalledWith({
      method: 'serviceFutureFeature.runFutureCommand',
      operation: expect.any(Function),
    });
    expect(mockCallBackgroundMethod).not.toHaveBeenCalled();
  });
});
