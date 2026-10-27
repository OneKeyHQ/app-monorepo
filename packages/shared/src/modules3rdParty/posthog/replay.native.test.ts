import { OneKeyLocalError } from '../../errors';

import type { IInitSessionReplayOptions } from './replayTypes';

const mockPlatformEnv = {
  isNativeMainThread: true,
  isNativeIOS: true,
  isNativeAndroid: false,
  isDev: false,
  isE2E: false,
};

const mockNativeModule = {
  stopRecording: jest.fn(async () => undefined),
};
let mockNativeModulePresent = true;

const mockAppStateListeners: Array<(state: string) => void> = [];

const mockPlugin = {
  setup: jest.fn(async (..._args: unknown[]) => undefined),
  startRecording: jest.fn(async (_resumeCurrent: boolean) => undefined),
  stopRecording: jest.fn(async () => undefined),
  isEnabled: jest.fn(async () => true),
  startSession: jest.fn(async (_sessionId: string) => undefined),
  endSession: jest.fn(async () => undefined),
};
const mockPluginImported = jest.fn();

const mockStore = new Map<string, unknown>();

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_type: string, listener: (state: string) => void) => {
      mockAppStateListeners.push(listener);
      return { remove: jest.fn() };
    },
  },
  NativeModules: {},
  NativeEventEmitter: class {},
  Platform: {
    OS: 'ios',
    select: (options: Record<string, unknown>) =>
      options.ios ?? options.default,
  },
  TurboModuleRegistry: {
    get: (name: string) =>
      mockNativeModulePresent && name === 'PosthogReactNativePlugin'
        ? mockNativeModule
        : null,
  },
}));

jest.mock('@posthog/react-native-plugin', () => {
  mockPluginImported();
  return { __esModule: true, default: mockPlugin };
});

jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getObject: (key: string) => mockStore.get(key),
      setObject: (key: string, value: unknown) => {
        mockStore.set(key, JSON.parse(JSON.stringify(value)));
      },
    },
  },
}));

// The web jest project resolves the no-op variant; replay.native.ts runs on
// native, where Metro picks the .native file.
jest.mock('./replayEarlyStop', () =>
  jest.requireActual<typeof import('./replayEarlyStop.native')>(
    './replayEarlyStop.native',
  ),
);

jest.mock('../../analytics', () => ({
  analytics: { setReplayContext: jest.fn() },
}));

type IReplayModule = typeof import('./replay.native');
type IGateModule = typeof import('./replayGate');

const T0 = 1_760_000_000_000;
const MINUTE = 60 * 1000;
const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const TEST_OPTIONS: IInitSessionReplayOptions = {
  instanceId: 'instance-1',
  enableTestEndpoint: true,
  forceRecord: true,
};

function loadModules(): { replay: IReplayModule; gate: IGateModule } {
  let replay: IReplayModule | undefined;
  let gate: IGateModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    replay = require('./replay.native') as IReplayModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gate = require('./replayGate') as IGateModule;
  });
  return { replay: replay as IReplayModule, gate: gate as IGateModule };
}

async function flush(ms = 0) {
  await jest.advanceTimersByTimeAsync(ms);
}

describe('replay.native', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
    process.env.POSTHOG_REPLAY_TOKEN_TEST = 'phc_test_placeholder';
    delete process.env.POSTHOG_REPLAY_TOKEN_PROD;
    Object.assign(mockPlatformEnv, {
      isNativeMainThread: true,
      isNativeIOS: true,
      isNativeAndroid: false,
      isDev: false,
      isE2E: false,
    });
    mockNativeModulePresent = true;
    mockAppStateListeners.length = 0;
    mockStore.clear();
    jest.clearAllMocks();
    mockPlugin.isEnabled.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnv };
  });

  it('builds the exact setup payload', () => {
    const { replay } = loadModules();
    expect(
      replay.buildReplaySdkOptions({
        token: 'phc_x',
        host: 'https://eu.i.posthog.com',
        instanceId: 'instance-1',
      }),
    ).toEqual({
      apiKey: 'phc_x',
      host: 'https://eu.i.posthog.com',
      distinctId: 'instance-1',
      anonymousId: 'instance-1',
      sdkVersion: replay.REPLAY_PLUGIN_SDK_VERSION,
      preloadFeatureFlags: false,
      optOut: false,
      flushAt: 20,
    });
    expect(replay.REPLAY_PLUGIN_SDK_VERSION).not.toBe('');
    expect(replay.buildReplayPluginConfig()).toEqual({
      sessionReplay: {
        enabled: false,
        decideReplayConfig: {},
        sdkReplayConfig: {
          maskAllTextInputs: true,
          maskAllImages: true,
          maskAllSandboxedViews: true,
          captureLog: false,
          captureNetworkTelemetry: false,
          captureTouches: false,
          throttleDelayMs: 1000,
          sampleRate: 1,
          screenshotModeBackgroundCapture: false,
          verifyScreenshotMaskAlignment: true,
        },
      },
      errorTracking: {
        nativeAutocapture: false,
        androidNdkCrashes: false,
        fatalExceptionMarker: false,
      },
      push: {
        capturePushNotificationSubscriptions: false,
        capturePushNotificationOpened: false,
        pushIdentityProviderEnabled: false,
      },
      rageClick: { enabled: false },
    });
  });

  it('can import the real plugin without its native module; calls fail synchronously', () => {
    const actual = jest.requireActual<{
      default: { stopRecording: () => Promise<void> };
    }>('@posthog/react-native-plugin');
    expect(() => actual.default.stopRecording()).toThrow(
      /doesn't seem to be linked/,
    );
  });

  it('does nothing outside the native main runtime', async () => {
    mockPlatformEnv.isNativeMainThread = false;
    const { replay, gate } = loadModules();
    await replay.initSessionReplay(TEST_OPTIONS);
    expect(mockNativeModule.stopRecording).not.toHaveBeenCalled();
    expect(gate.getReplayGateStatus().hasController).toBe(false);
  });

  it('is safe on a native build without the plugin', async () => {
    mockNativeModulePresent = false;
    const { replay, gate } = loadModules();
    await expect(replay.initSessionReplay(TEST_OPTIONS)).resolves.toBe(
      undefined,
    );
    expect(gate.getReplayGateStatus().hasController).toBe(false);
    expect(mockPluginImported).not.toHaveBeenCalled();
  });

  it('stops leftover recording once per JS context even when replay is off', async () => {
    const { replay, gate } = loadModules();
    const prodOptions = { ...TEST_OPTIONS, enableTestEndpoint: false };
    await replay.initSessionReplay(prodOptions);
    await replay.initSessionReplay(prodOptions);
    expect(mockNativeModule.stopRecording).toHaveBeenCalledTimes(1);
    expect(gate.getReplayGateStatus().hasController).toBe(false);
    expect(mockPluginImported).not.toHaveBeenCalled();
    expect(mockStore.size).toBe(0);
  });

  it('keeps dev and E2E builds off unless the test endpoint is on', async () => {
    mockPlatformEnv.isDev = true;
    process.env.POSTHOG_REPLAY_TOKEN_PROD = 'phc_prod_placeholder';
    const { replay, gate } = loadModules();
    await replay.initSessionReplay({
      ...TEST_OPTIONS,
      enableTestEndpoint: false,
    });
    expect(gate.getReplayGateStatus().hasController).toBe(false);

    const second = loadModules();
    await second.replay.initSessionReplay(TEST_OPTIONS);
    expect(second.gate.getReplayGateStatus().hasController).toBe(true);
  });

  it('never touches the plugin for an unsampled production session', async () => {
    process.env.POSTHOG_REPLAY_TOKEN_PROD = 'phc_prod_placeholder';
    const { replay, gate } = loadModules();
    await replay.initSessionReplay({
      instanceId: 'instance-1',
      enableTestEndpoint: false,
      forceRecord: true,
    });
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flush(1000);

    expect(gate.getReplayGateStatus()).toMatchObject({
      hasController: true,
      sampled: false,
      forced: false,
    });
    expect(mockPluginImported).not.toHaveBeenCalled();
    expect(mockPlugin.setup).not.toHaveBeenCalled();
  });

  it('sets up lazily with the session id and records with resumeCurrent', async () => {
    const { replay, gate } = loadModules();
    await replay.initSessionReplay(TEST_OPTIONS);
    const { sessionId } = gate.getReplayGateStatus();
    expect(sessionId).toMatch(UUID_V7_RE);
    expect(mockPlugin.setup).not.toHaveBeenCalled();

    gate.setReplayRouteAllowed(true, 'tab.market');
    await flush(1000);

    expect(mockPlugin.setup).toHaveBeenCalledTimes(1);
    expect(mockPlugin.setup).toHaveBeenCalledWith(
      sessionId,
      replay.buildReplaySdkOptions({
        token: 'phc_test_placeholder',
        host: 'https://eu.i.posthog.com',
        instanceId: 'instance-1',
      }),
      replay.buildReplayPluginConfig(),
    );
    expect(mockPlugin.startRecording).toHaveBeenCalledWith(true);
    expect(mockPlugin.startRecording).not.toHaveBeenCalledWith(false);
    expect(gate.getReplayGateStatus().recording).toBe(true);

    const release = gate.acquireReplayPause('password');
    await flush();
    expect(mockPlugin.stopRecording).toHaveBeenCalledTimes(1);
    release();
    await flush(1000);
    expect(mockPlugin.setup).toHaveBeenCalledTimes(1);
    expect(mockPlugin.startRecording).toHaveBeenCalledTimes(2);
  });

  it('rotates the native session after 30 minutes in the background', async () => {
    const { replay, gate } = loadModules();
    await replay.initSessionReplay(TEST_OPTIONS);
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flush(1000);
    const firstSessionId = gate.getReplayGateStatus().sessionId;

    for (const listener of mockAppStateListeners) {
      listener('background');
    }
    await flush(31 * MINUTE);
    for (const listener of mockAppStateListeners) {
      listener('active');
    }
    gate.notifyReplayActivity();
    await flush();

    const nextSessionId = gate.getReplayGateStatus().sessionId;
    expect(nextSessionId).toMatch(UUID_V7_RE);
    expect(nextSessionId).not.toBe(firstSessionId);
    const stopOrder = mockPlugin.stopRecording.mock.invocationCallOrder[0];
    const endOrder = mockPlugin.endSession.mock.invocationCallOrder[0];
    const startSessionOrder =
      mockPlugin.startSession.mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(endOrder);
    expect(endOrder).toBeLessThan(startSessionOrder);
    expect(mockPlugin.startSession).toHaveBeenCalledWith(nextSessionId);

    await flush(1000);
    expect(mockPlugin.startRecording).toHaveBeenCalledTimes(2);
  });

  it('keeps the session when the app returns quickly', async () => {
    const { replay, gate } = loadModules();
    await replay.initSessionReplay(TEST_OPTIONS);
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flush(1000);
    const firstSessionId = gate.getReplayGateStatus().sessionId;

    for (const listener of mockAppStateListeners) {
      listener('background');
    }
    await flush(5 * MINUTE);
    for (const listener of mockAppStateListeners) {
      listener('active');
    }
    gate.notifyReplayActivity();
    await flush();

    expect(gate.getReplayGateStatus().sessionId).toBe(firstSessionId);
    expect(mockPlugin.startSession).not.toHaveBeenCalled();
  });

  it('updates forced on a later init and refuses a different project', async () => {
    const { replay, gate } = loadModules();
    await replay.initSessionReplay({ ...TEST_OPTIONS, forceRecord: false });
    expect(gate.getReplayGateStatus()).toMatchObject({
      hasController: true,
      forced: false,
    });

    await replay.initSessionReplay(TEST_OPTIONS);
    expect(gate.getReplayGateStatus().forced).toBe(true);

    process.env.POSTHOG_REPLAY_TOKEN_PROD = 'phc_prod_placeholder';
    await replay.initSessionReplay({
      ...TEST_OPTIONS,
      enableTestEndpoint: false,
    });
    expect(gate.getReplayGateStatus().hasController).toBe(false);

    await replay.initSessionReplay(TEST_OPTIONS);
    expect(gate.getReplayGateStatus().hasController).toBe(false);
  });

  it('retries setup on the next attempt when the plugin fails to load', async () => {
    // prepare() and start() each try once per attempt.
    mockPlugin.setup
      .mockRejectedValueOnce(new OneKeyLocalError('not linked'))
      .mockRejectedValueOnce(new OneKeyLocalError('not linked'));
    const { replay, gate } = loadModules();
    await replay.initSessionReplay(TEST_OPTIONS);
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flush(1000);
    expect(mockPlugin.setup).toHaveBeenCalledTimes(2);
    expect(mockPlugin.startRecording).not.toHaveBeenCalled();
    expect(gate.getReplayGateStatus().recording).toBe(false);

    await flush(2000);
    expect(mockPlugin.setup).toHaveBeenCalledTimes(3);
    expect(mockPlugin.startRecording).toHaveBeenCalledWith(true);
    expect(gate.getReplayGateStatus().recording).toBe(true);
  });

  it('retries start while the native SDK reports replay inactive', async () => {
    mockPlugin.isEnabled.mockResolvedValueOnce(false);
    const { replay, gate } = loadModules();
    await replay.initSessionReplay(TEST_OPTIONS);
    gate.setReplayRouteAllowed(true, 'tab.market');
    await flush(1000);
    expect(mockPlugin.startRecording).toHaveBeenCalledTimes(1);
    expect(gate.getReplayGateStatus().recording).toBe(false);

    await flush(1000);
    expect(mockPlugin.startRecording).toHaveBeenCalledTimes(2);
    expect(mockPlugin.setup).toHaveBeenCalledTimes(1);
    expect(gate.getReplayGateStatus().recording).toBe(true);
  });
});
