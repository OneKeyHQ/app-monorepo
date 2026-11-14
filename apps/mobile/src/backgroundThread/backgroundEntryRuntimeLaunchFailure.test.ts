import type { IBackgroundThreadRequest } from './rpcProtocol';

const mockBootstrapOrder: string[] = [];

let mockRequestExecutor:
  | ((request: IBackgroundThreadRequest) => Promise<unknown>)
  | undefined;
const mockReportBackgroundThreadInitializationFailure = jest.fn<
  void,
  [unknown]
>();
const mockExecuteNativeStorageRequest = jest.fn<
  Promise<{
    coldStart: unknown[];
    devSettings: unknown[];
    settings: unknown[];
  }>,
  [unknown]
>(async () => ({
  coldStart: [],
  devSettings: [],
  settings: [],
}));
const mockBusinessModuleLoaded = jest.fn();

let mockResolveExecutorInstalled: (() => void) | undefined;
const mockExecutorInstalled = new Promise<void>((resolve) => {
  mockResolveExecutorInstalled = resolve;
});

jest.mock('@onekeyhq/shared/src/polyfills', () => {
  mockBootstrapOrder.push('polyfills');
  return {};
});
jest.mock('@onekeyhq/shared/src/errors/nativePromiseRejectionTracker', () => ({
  prepareNativePromiseRejectionTracker: jest.fn(() => {
    mockBootstrapOrder.push('promise-rejection-tracker-ready');
  }),
}));
jest.mock('../security/finishMobileLockdown', () => ({
  finishMobileLockdown: jest.fn((runtime: 'main' | 'background') => {
    mockBootstrapOrder.push(`lockdown-${runtime}`);
  }),
}));
jest.mock('@onekeyhq/shared/src/polyfills/runtimeCapabilities', () => ({
  markRuntimePolyfillsReady: jest.fn(() => {
    mockBootstrapOrder.push('polyfills-ready');
  }),
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/sentry', () => ({
  initSentry: jest.fn(),
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
jest.mock('./setupBackgroundThreadRPCHandler', () => ({
  reportBackgroundThreadInitializationFailure: (error: unknown) => {
    mockReportBackgroundThreadInitializationFailure(error);
  },
  setBackgroundThreadRequestExecutor: (
    executor: (request: IBackgroundThreadRequest) => Promise<unknown>,
  ) => {
    mockRequestExecutor = executor;
    mockBootstrapOrder.push('executor');
    mockResolveExecutorInstalled?.();
  },
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageExecutor', () => ({
  executeNativeStorageRequest: (request: unknown) =>
    mockExecuteNativeStorageRequest(request),
  prepareNativeStorageForBackgroundStartup: jest.fn(async () => undefined),
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {},
}));
jest.mock(
  '@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement',
  () => ({
    completeTravelModeRuntimeLaunchAcknowledgement: jest.fn(async () => false),
  }),
);
jest.mock('@onekeyhq/shared/src/travelMode/runtimeLaunchGate', () => ({
  installTravelModeRuntimeLaunchGate: jest.fn(() => true),
}));
jest.mock('@onekeyhq/kit-bg/src/apis/TravelModeCommandDispatcher', () => ({
  travelModeCommandDispatcher: {
    runTransportServiceCall: jest.fn(
      async ({ operation }: { operation: () => Promise<unknown> }) =>
        operation(),
    ),
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  mockBusinessModuleLoaded();
  return {
    __esModule: true,
    default: {
      bridgeReceiveHandler: jest.fn(),
      callBackgroundMethod: jest.fn(),
    },
  };
});

describe('background entry runtime-launch recovery', () => {
  it('keeps the bootstrap-only executor alive when launch acknowledgement fails', async () => {
    jest.isolateModules(() => {
      require('../../background');
    });

    await mockExecutorInstalled;
    for (let index = 0; index < 5; index += 1) {
      await Promise.resolve();
    }

    expect(mockBootstrapOrder).toEqual([
      'polyfills',
      'promise-rejection-tracker-ready',
      'lockdown-background',
      'polyfills-ready',
      'executor',
    ]);

    await expect(
      mockRequestExecutor?.({
        type: 'service-call',
        method: 'nativeStorage',
        params: [{ scope: 'bootstrap' }],
        sync: false,
      }),
    ).resolves.toEqual({ coldStart: [], devSettings: [], settings: [] });
    expect(mockExecuteNativeStorageRequest).toHaveBeenCalledWith({
      scope: 'bootstrap',
    });
    expect(
      mockReportBackgroundThreadInitializationFailure,
    ).not.toHaveBeenCalled();
    expect(mockBusinessModuleLoaded).not.toHaveBeenCalled();
  });
});
