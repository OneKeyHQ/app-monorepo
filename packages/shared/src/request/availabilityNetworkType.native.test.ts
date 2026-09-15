import { OneKeyLocalError } from '../errors';

const mockListeners: Array<(state: unknown) => void> = [];
const mockGetCurrentState = jest.fn();
let mockNetInfoModule: unknown;

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: { isJest: false },
}));

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: (_event: string, listener: (state: unknown) => void) => {
      mockListeners.push(listener);
    },
  })),
  NativeModules: {},
  TurboModuleRegistry: { get: () => mockNetInfoModule },
}));

type INetworkTypeModule = typeof import('./availabilityNetworkType.native');

function loadModule() {
  let loaded: INetworkTypeModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<INetworkTypeModule>(
      './availabilityNetworkType.native',
    );
  });
  return loaded as INetworkTypeModule;
}

describe('availabilityNetworkType.native', () => {
  beforeEach(() => {
    mockListeners.length = 0;
    mockGetCurrentState.mockReset();
    mockNetInfoModule = { getCurrentState: mockGetCurrentState };
  });

  it('passes the TurboModule argument explicitly and follows change events', async () => {
    let resolveSeed: (state: unknown) => void = () => undefined;
    mockGetCurrentState.mockReturnValue(
      new Promise((resolve) => {
        resolveSeed = resolve;
      }),
    );
    const networkType = loadModule();
    networkType.startAvailabilityNetworkTypeTracking();
    networkType.startAvailabilityNetworkTypeTracking();

    // A zero-argument TurboModule call crashes on iOS.
    expect(mockGetCurrentState.mock.calls).toEqual([[undefined]]);

    mockListeners[0]({ type: 'wifi' });
    resolveSeed({ type: 'cellular' });
    await Promise.resolve();
    await Promise.resolve();
    expect(networkType.getAvailabilityNetworkType()).toBe('wifi');
  });

  it('uses the seed when no change event arrived first', async () => {
    mockGetCurrentState.mockResolvedValue({ type: 'cellular' });
    const networkType = loadModule();
    networkType.startAvailabilityNetworkTypeTracking();
    await Promise.resolve();
    await Promise.resolve();
    expect(networkType.getAvailabilityNetworkType()).toBe('cellular');
  });

  it('never throws when the native module is missing or fails', () => {
    mockNetInfoModule = undefined;
    expect(() =>
      loadModule().startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();

    mockNetInfoModule = {
      getCurrentState: () => {
        throw new OneKeyLocalError('argument count');
      },
    };
    const networkType = loadModule();
    expect(() =>
      networkType.startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();
    expect(networkType.getAvailabilityNetworkType()).toBeUndefined();
  });
});
