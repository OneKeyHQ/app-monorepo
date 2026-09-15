import { OneKeyLocalError } from '../errors';

const mockListeners: Array<(state: unknown) => void> = [];
const mockEmitterModules: unknown[] = [];
let mockEmitterThrows = false;
const mockGetCurrentState = jest.fn();
const mockPlatformEnv = { isJest: false };
let mockTurboModule: unknown = null;
let mockLegacyModule: unknown;

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn().mockImplementation((nativeModule: unknown) => {
    mockEmitterModules.push(nativeModule);
    if (mockEmitterThrows) {
      throw new (jest.requireActual<typeof import('../errors')>(
        '../errors',
      ).OneKeyLocalError)('emitter unavailable');
    }
    return {
      addListener: (_event: string, listener: (state: unknown) => void) => {
        mockListeners.push(listener);
        return { remove: jest.fn() };
      },
    };
  }),
  NativeModules: {
    get RNCNetInfo() {
      return mockLegacyModule;
    },
  },
  TurboModuleRegistry: {
    get: () => mockTurboModule,
  },
}));

type INetworkTypeModule = typeof import('./availabilityNetworkType.native');

function loadModule(): INetworkTypeModule {
  let loaded: INetworkTypeModule | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<INetworkTypeModule>(
      './availabilityNetworkType.native',
    );
  });
  if (!loaded) throw new OneKeyLocalError('module not loaded');
  return loaded;
}

describe('availabilityNetworkType.native', () => {
  beforeEach(() => {
    mockListeners.length = 0;
    mockEmitterModules.length = 0;
    mockEmitterThrows = false;
    mockGetCurrentState.mockReset();
    mockPlatformEnv.isJest = false;
    mockTurboModule = null;
    mockLegacyModule = {
      getCurrentState: mockGetCurrentState,
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    };
  });

  it('seeds from the native module and follows change events without details', async () => {
    let resolveSeed: ((state: unknown) => void) | undefined;
    mockGetCurrentState.mockReturnValue(
      new Promise((resolve) => {
        resolveSeed = resolve;
      }),
    );
    const networkType = loadModule();
    expect(networkType.getAvailabilityNetworkType()).toBe('unknown');

    networkType.startAvailabilityNetworkTypeTracking();
    networkType.startAvailabilityNetworkTypeTracking();
    expect(mockGetCurrentState).toHaveBeenCalledTimes(1);
    // TurboModule calls must pass the declared argument count explicitly.
    expect(mockGetCurrentState.mock.calls[0]).toHaveLength(1);
    expect(mockGetCurrentState).toHaveBeenCalledWith(undefined);
    expect(mockListeners).toHaveLength(1);

    resolveSeed?.({
      type: 'cellular',
      details: { carrier: 'Carrier', ipAddress: '10.0.0.2' },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(networkType.getAvailabilityNetworkType()).toBe('cellular');

    mockListeners[0]({ type: 'wifi', details: { ssid: 'home' } });
    expect(networkType.getAvailabilityNetworkType()).toBe('wifi');
    mockListeners[0]({ type: 'none' });
    expect(networkType.getAvailabilityNetworkType()).toBe('offline');
  });

  it('does not let a late seed overwrite a newer change event', async () => {
    let resolveSeed: ((state: unknown) => void) | undefined;
    mockGetCurrentState.mockReturnValue(
      new Promise((resolve) => {
        resolveSeed = resolve;
      }),
    );
    const networkType = loadModule();
    networkType.startAvailabilityNetworkTypeTracking();

    mockListeners[0]({ type: 'wifi' });
    resolveSeed?.({ type: 'cellular' });
    await Promise.resolve();
    await Promise.resolve();

    expect(networkType.getAvailabilityNetworkType()).toBe('wifi');
  });

  it('prefers the TurboModule and stays unknown when no module exists', async () => {
    const turboGetCurrentState = jest
      .fn()
      .mockResolvedValue({ type: 'ethernet' });
    mockTurboModule = {
      getCurrentState: turboGetCurrentState,
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    };
    const withTurbo = loadModule();
    withTurbo.startAvailabilityNetworkTypeTracking();
    expect(turboGetCurrentState).toHaveBeenCalledWith(undefined);
    expect(mockGetCurrentState).not.toHaveBeenCalled();
    expect(mockEmitterModules).toEqual([mockTurboModule]);
    await Promise.resolve();
    await Promise.resolve();
    expect(withTurbo.getAvailabilityNetworkType()).toBe('ethernet');

    mockTurboModule = null;
    mockLegacyModule = undefined;
    const withoutModule = loadModule();
    expect(() =>
      withoutModule.startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();
    expect(withoutModule.getAvailabilityNetworkType()).toBe('unknown');
  });

  it('swallows synchronous native failures and does not retry', () => {
    mockEmitterThrows = true;
    const networkType = loadModule();

    expect(() =>
      networkType.startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();
    expect(() =>
      networkType.startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();

    expect(mockEmitterModules).toHaveLength(1);
    expect(mockGetCurrentState).not.toHaveBeenCalled();
    expect(networkType.getAvailabilityNetworkType()).toBe('unknown');
  });

  it('never throws when the native module misbehaves', async () => {
    mockGetCurrentState.mockRejectedValue(
      new OneKeyLocalError('native failure'),
    );
    const networkType = loadModule();
    expect(() =>
      networkType.startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();
    expect(mockGetCurrentState).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(networkType.getAvailabilityNetworkType()).toBe('unknown');
  });

  it('swallows a synchronous getCurrentState failure and does not retry', () => {
    mockGetCurrentState.mockImplementation(() => {
      throw new OneKeyLocalError('argument count');
    });
    const networkType = loadModule();

    expect(() =>
      networkType.startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();
    expect(() =>
      networkType.startAvailabilityNetworkTypeTracking(),
    ).not.toThrow();

    expect(mockGetCurrentState).toHaveBeenCalledTimes(1);
    expect(networkType.getAvailabilityNetworkType()).toBe('unknown');
  });

  it('builds no emitter when no native module exists', () => {
    mockLegacyModule = undefined;
    const networkType = loadModule();
    networkType.startAvailabilityNetworkTypeTracking();
    expect(mockEmitterModules).toHaveLength(0);
  });
});
