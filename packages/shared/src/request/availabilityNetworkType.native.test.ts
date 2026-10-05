import { OneKeyLocalError } from '../errors';

const mockListeners: Array<(state: unknown) => void> = [];
const mockGetCurrentState = jest.fn();
let mockNetInfoModule: unknown;
let mockEmitterFails = false;
const mockEmitterError = () => new OneKeyLocalError('emitter unavailable');

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: { isJest: false },
}));

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn().mockImplementation(() => {
    if (mockEmitterFails) throw mockEmitterError();
    return {
      addListener: (_event: string, listener: (state: unknown) => void) => {
        mockListeners.push(listener);
      },
    };
  }),
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

/** Drains the seed promise's `then` handlers. */
async function settleSeed() {
  await Promise.resolve();
  await Promise.resolve();
}

let mockNow = 0;

/** A later counted request, past the tracker's retry spacing. */
async function nextRequest(networkType: INetworkTypeModule) {
  mockNow += 10_000;
  networkType.startAvailabilityNetworkTypeTracking();
  await settleSeed();
}

describe('availabilityNetworkType.native', () => {
  beforeEach(() => {
    mockListeners.length = 0;
    mockGetCurrentState.mockReset();
    mockEmitterFails = false;
    mockNow = Date.UTC(2026, 0, 1, 8);
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    mockNetInfoModule = { getCurrentState: mockGetCurrentState };
  });

  afterEach(() => {
    jest.spyOn(Date, 'now').mockRestore();
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

  it('picks up a module that registers after the first counted request', async () => {
    // The shipped bug: a flag latched before the module resolved, so the
    // earliest request disabled the tracker for the life of the runtime.
    mockNetInfoModule = undefined;
    const networkType = loadModule();
    networkType.startAvailabilityNetworkTypeTracking();
    expect(mockGetCurrentState).not.toHaveBeenCalled();

    mockNetInfoModule = { getCurrentState: mockGetCurrentState };
    mockGetCurrentState.mockResolvedValue({ type: 'wifi' });
    await nextRequest(networkType);

    expect(networkType.getAvailabilityNetworkType()).toBe('wifi');
    // One listener per runtime, however many requests called in.
    await nextRequest(networkType);
    expect(mockListeners).toHaveLength(1);
  });

  it('still seeds the type when the event emitter cannot be constructed', async () => {
    // The seed is the only path that yields a type when no change event ever
    // arrives, so an emitter failure must not skip it.
    mockEmitterFails = true;
    mockGetCurrentState.mockResolvedValue({ type: 'cellular' });
    const networkType = loadModule();
    networkType.startAvailabilityNetworkTypeTracking();
    await settleSeed();

    expect(mockGetCurrentState).toHaveBeenCalledTimes(1);
    expect(networkType.getAvailabilityNetworkType()).toBe('cellular');
  });

  it('retries a rejected seed a bounded number of times, adding no listener', async () => {
    mockGetCurrentState.mockRejectedValue(new OneKeyLocalError('no state'));
    const networkType = loadModule();
    for (let request = 0; request < 20; request += 1) {
      // eslint-disable-next-line no-await-in-loop
      await nextRequest(networkType);
    }
    // Bounded, so a module that never answers costs a fixed number of native
    // calls per runtime rather than one per request.
    expect(mockGetCurrentState).toHaveBeenCalledTimes(8);
    expect(mockListeners).toHaveLength(1);

    // A seed that succeeds stops the retries at once.
    mockGetCurrentState.mockReset();
    mockGetCurrentState.mockResolvedValue({ type: 'wifi' });
    const second = loadModule();
    await nextRequest(second);
    await nextRequest(second);
    expect(mockGetCurrentState).toHaveBeenCalledTimes(1);
    expect(second.getAvailabilityNetworkType()).toBe('wifi');
  });

  it('throttles retries so a missing module is not looked up per request', async () => {
    mockNetInfoModule = undefined;
    const networkType = loadModule();
    for (let request = 0; request < 12; request += 1) {
      networkType.startAvailabilityNetworkTypeTracking();
    }
    expect(mockGetCurrentState).not.toHaveBeenCalled();

    mockNetInfoModule = { getCurrentState: mockGetCurrentState };
    mockGetCurrentState.mockResolvedValue({ type: 'wifi' });
    // The burst above consumed one attempt, not twelve.
    await nextRequest(networkType);
    expect(networkType.getAvailabilityNetworkType()).toBe('wifi');
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
