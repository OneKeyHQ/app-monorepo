import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import type { INativeStorageGlobal } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

const mockSharedRPCWrite = jest.fn();
const mockAppEventEmit = jest.fn();
const mockGetWebEmbedApiReadyState = jest
  .fn<Promise<{ ready: boolean; mountId?: string }>, []>()
  .mockResolvedValue({ ready: false });
const mockSharedRPCRegisterReadinessKey = jest.fn();
const mockSharedStoreSet = jest.fn();
const mockNativeLoggerWrite = jest.fn();
let mockRejectErrorKeyAssignment = false;
const mockAsyncStorageWriteForwarderGlobal: Record<string, unknown> = {};
const mockJotaiUpdateFromUiByBgBroadcast = jest.fn<
  Promise<void>,
  [IGlobalStatesSyncBroadcastParams]
>(async () => undefined);

let mockInboundMessageHandler:
  | ((key: string, value: string | number | boolean) => void)
  | undefined;
const mockAppEventHandlers: Record<string, (payload: any) => void> = {};
const mockAppEventListeners: Record<
  string,
  Set<(payload: unknown) => void>
> = {};

const mockReadyPayload = JSON.stringify({
  runtime: 'background',
  status: 'ready',
  protocolVersion: '1',
  bootId: 'test-boot-id',
  ts: 1,
});
let mockReadySignalPayload = mockReadyPayload;

jest.mock('@onekeyfe/react-native-background-thread', () => ({
  getSharedRPC: () => ({
    write: mockSharedRPCWrite,
    onWrite: (
      handler: (key: string, value: string | number | boolean) => void,
    ) => {
      mockInboundMessageHandler = handler;
    },
    registerReadinessKey: mockSharedRPCRegisterReadinessKey,
  }),
  getSharedStore: () => ({
    get: () => mockReadySignalPayload,
    keys: () => [],
    set: mockSharedStoreSet,
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    enableNativeBackgroundThread: true,
    isNativeAndroid: true,
    isNativeBackgroundThread: false,
    isNativeIOS: false,
    isNativeMainThread: true,
  },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class OneKeyLocalError extends Error {
    key = 'onekey_error';

    // Mirrors OneKeyError#constructorName: a getter-only accessor. Assigning
    // to it in strict mode throws, which is the trap that used to skip
    // pendingCall.reject and hang the caller (OK-61451, OK-61417).
    get constructorName() {
      return this.constructor.name;
    }

    constructor(message: string) {
      super(message);
      if (mockRejectErrorKeyAssignment) {
        Object.defineProperty(this, 'key', {
          configurable: true,
          enumerable: true,
          value: 'onekey_error',
          writable: false,
        });
      }
    }
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Error: 'error', Info: 'info' },
    NativeLogger: { write: mockNativeLoggerWrite },
  }),
);

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      serviceDApp: {
        getWebEmbedApiReadyState: () => mockGetWebEmbedApiReadyState(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    LoadWebEmbedWebView: 'LoadWebEmbedWebView',
    LoadWebEmbedWebViewComplete: 'LoadWebEmbedWebViewComplete',
    WebEmbedWebViewMountRequested: 'WebEmbedWebViewMountRequested',
    WebEmbedWebViewNotReady: 'WebEmbedWebViewNotReady',
    WebEmbedWebViewProviderReady: 'WebEmbedWebViewProviderReady',
  },
  appEventBus: {
    dispatchInboundFromBackground: jest.fn(),
    emit: mockAppEventEmit,
    on: jest.fn((name: string, handler: (payload: unknown) => void) => {
      mockAppEventListeners[name] ??= new Set();
      mockAppEventListeners[name].add(handler);
      mockAppEventHandlers[name] = (payload: unknown) => {
        mockAppEventListeners[name].forEach((listener) => listener(payload));
      };
    }),
    off: jest.fn((name: string, handler: (payload: unknown) => void) => {
      mockAppEventListeners[name]?.delete(handler);
    }),
  },
}));

jest.mock(
  '@onekeyhq/shared/src/storage/asyncStorageWriteForwarderTypes',
  () => ({
    buildAsyncStorageWriteForwarderStatusKey: jest.fn(),
    getAsyncStorageWriteForwarderGlobal: () =>
      mockAsyncStorageWriteForwarderGlobal,
    parseAsyncStorageWriteForwarderRequestStatus: jest.fn(),
    serializeAsyncStorageWriteForwarderRequestStatus: jest.fn(),
  }),
);

jest.mock('@onekeyhq/shared/src/utils/imageUtils.embedBridge', () => ({
  registerImageEmbedBridge: jest.fn(),
}));

jest.mock('@onekeyhq/kit-bg/src/apis/backgroundApiPermissions', () => ({
  isWebEmbedApiAllowedOrigin: jest.fn(() => true),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi', () => ({
  jotaiUpdateFromUiByBgBroadcast: (params: IGlobalStatesSyncBroadcastParams) =>
    mockJotaiUpdateFromUiByBgBroadcast(params),
}));

jest.mock(
  '@onekeyhq/shared/src/storage/instance/nativeSyncStorageMirror',
  () => ({ refreshNativeSyncStorageMirrors: jest.fn() }),
);

jest.mock('./runtimeState', () => ({
  setBackgroundThreadReadyPayload: jest.fn(),
}));

describe('main thread background runner', () => {
  beforeEach(() => {
    mockRejectErrorKeyAssignment = false;
    mockGetWebEmbedApiReadyState.mockResolvedValue({ ready: false });
  });

  afterAll(() => {
    delete (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport?: unknown;
      }
    ).__onekeyNativeBackgroundThreadTransport;
  });

  it('waits for the current page before dispatching a background WebEmbed request', async () => {
    await import('./setupMainThreadBackgroundRunner');
    const transport = (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport?: {
          syncBridgeConnection: (
            params: {
              channel: 'webEmbed';
              bridge: {
                request: jest.Mock;
                globalOnMessageEnabled: boolean;
              } | null;
              mountId?: string;
              mountSequence?: number;
            },
            fallback: () => Promise<unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__onekeyNativeBackgroundThreadTransport;
    const oldRequest = jest.fn().mockResolvedValue('old');
    const newRequest = jest.fn().mockResolvedValue('new');
    const oldBridge = { request: oldRequest, globalOnMessageEnabled: true };
    const newBridge = { request: newRequest, globalOnMessageEnabled: true };

    mockAppEventHandlers.WebEmbedWebViewMountRequested({
      mountId: 'old-page',
      mountSequence: 100,
    });
    void transport?.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: oldBridge,
        mountId: 'old-page',
        mountSequence: 100,
      },
      async () => undefined,
    );
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: 'old-page' });
    mockAppEventHandlers.WebEmbedWebViewMountRequested({
      mountId: 'new-page',
      mountSequence: 101,
    });
    await expect(
      transport?.syncBridgeConnection(
        { channel: 'webEmbed', bridge: oldBridge },
        async () => undefined,
      ),
    ).resolves.toBe(false);
    await expect(
      transport?.syncBridgeConnection(
        { channel: 'webEmbed', bridge: null },
        async () => undefined,
      ),
    ).resolves.toBe(false);
    mockInboundMessageHandler?.('onekey:webembed:req:owner-test', '{}');
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    expect(oldRequest).not.toHaveBeenCalled();

    void transport?.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: newBridge,
        mountId: 'new-page',
        mountSequence: 101,
      },
      async () => undefined,
    );
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: 'old-page' });
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    expect(newRequest).not.toHaveBeenCalled();

    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: 'new-page' });
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    expect(newRequest).toHaveBeenCalledTimes(1);
    expect(oldRequest).not.toHaveBeenCalled();
    await expect(
      transport?.syncBridgeConnection(
        { channel: 'webEmbed', bridge: null },
        async () => undefined,
      ),
    ).resolves.toBe(false);
    mockGetWebEmbedApiReadyState.mockResolvedValue({
      ready: true,
      mountId: 'new-page',
    });
    void transport?.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: null,
        mountId: 'new-page',
        mountSequence: 101,
      },
      async () => undefined,
    );
    void transport?.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: newBridge,
        mountId: 'new-page',
        mountSequence: 101,
      },
      async () => undefined,
    );
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    mockInboundMessageHandler?.('onekey:webembed:req:reconnect-test', '{}');
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    expect(newRequest).toHaveBeenCalledTimes(2);
    mockSharedRPCWrite.mock.calls
      .filter(
        ([key]) => typeof key === 'string' && key.startsWith('onekey:bg:req:'),
      )
      .forEach(([key]) => {
        mockInboundMessageHandler?.(
          `onekey:bg:res:${(key as string).slice('onekey:bg:req:'.length)}`,
          JSON.stringify({ ok: true }),
        );
      });
    mockSharedRPCWrite.mockClear();
  });

  it('recovers after an owner change, coalesces rebuilds, and fences not-ready calls', async () => {
    await import('./setupMainThreadBackgroundRunner');
    const { registerImageEmbedBridge } =
      await import('@onekeyhq/shared/src/utils/imageUtils.embedBridge');
    const imageBridge = jest
      .mocked(registerImageEmbedBridge)
      .mock.calls.at(-1)?.[0];
    const transport = (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport: {
          syncBridgeConnection: (
            params: {
              channel: 'webEmbed';
              bridge: unknown;
              mountId: string;
              mountSequence: number;
            },
            fallback: () => Promise<unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__onekeyNativeBackgroundThreadTransport;
    const oldRequest = jest.fn().mockResolvedValue('old');
    const oldBridge = { request: oldRequest, globalOnMessageEnabled: true };
    const currentRequest = jest.fn().mockResolvedValue('current');
    const currentBridge = {
      request: currentRequest,
      globalOnMessageEnabled: true,
    };
    const settle = async () => {
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    };
    mockAppEventHandlers.WebEmbedWebViewMountRequested({
      mountId: 'retired',
      mountSequence: 200,
    });
    void transport.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: oldBridge,
        mountId: 'retired',
        mountSequence: 200,
      },
      async () => undefined,
    );
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: 'retired' });
    mockAppEventHandlers.WebEmbedWebViewMountRequested({
      mountId: 'failed',
      mountSequence: 201,
    });
    const disconnect = transport.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: null,
        mountId: 'retired',
        mountSequence: 200,
      },
      async () => undefined,
    );
    await settle();
    mockSharedRPCWrite.mock.calls
      .filter(
        ([key]) => typeof key === 'string' && key.startsWith('onekey:bg:req:'),
      )
      .forEach(([key]) => {
        mockInboundMessageHandler?.(
          `onekey:bg:res:${(key as string).slice('onekey:bg:req:'.length)}`,
          JSON.stringify({ ok: true, result: true }),
        );
      });
    await expect(disconnect).resolves.toBe(true);
    mockAppEventEmit.mockClear();
    const first = imageBridge?.convertToBlackAndWhiteImageBase64(
      'image',
      'image/png',
    );
    const second = imageBridge?.convertToBlackAndWhiteImageBase64(
      'image',
      'image/png',
    );
    await settle();
    expect(mockAppEventEmit).toHaveBeenCalledTimes(1);
    expect(oldRequest).not.toHaveBeenCalled();
    mockAppEventHandlers.WebEmbedWebViewMountRequested({
      mountId: 'recovered',
      mountSequence: 202,
    });
    void transport.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: currentBridge,
        mountId: 'recovered',
        mountSequence: 202,
      },
      async () => undefined,
    );
    await expect(
      transport.syncBridgeConnection(
        {
          channel: 'webEmbed',
          bridge: null,
          mountId: 'retired',
          mountSequence: 200,
        },
        async () => undefined,
      ),
    ).resolves.toBe(false);
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: 'retired' });
    await settle();
    expect(currentRequest).not.toHaveBeenCalled();
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: 'recovered' });
    await expect(first).resolves.toBe('current');
    await expect(second).resolves.toBe('current');
    mockAppEventHandlers.WebEmbedWebViewNotReady({ mountId: 'retired' });
    await expect(
      imageBridge?.convertToBlackAndWhiteImageBase64('image', 'image/png'),
    ).resolves.toBe('current');
    mockGetWebEmbedApiReadyState.mockResolvedValue({
      ready: true,
      mountId: 'recovered',
    });
    mockAppEventHandlers.WebEmbedWebViewNotReady({ mountId: 'recovered' });
    const pending = imageBridge?.convertToBlackAndWhiteImageBase64(
      'image',
      'image/png',
    );
    await settle();
    expect(currentRequest).toHaveBeenCalledTimes(3);
    expect(mockAppEventEmit).toHaveBeenCalledTimes(1);
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: 'recovered' });
    await expect(pending).resolves.toBe('current');
    mockSharedRPCWrite.mock.calls
      .filter(
        ([key]) => typeof key === 'string' && key.startsWith('onekey:bg:req:'),
      )
      .forEach(([key]) => {
        mockInboundMessageHandler?.(
          `onekey:bg:res:${(key as string).slice('onekey:bg:req:'.length)}`,
          JSON.stringify({ ok: true }),
        );
      });
    mockSharedRPCWrite.mockClear();
  });

  it('falls back to a serializable WebEmbed error response', async () => {
    const { serializeWebEmbedBridgeError } =
      await import('./setupMainThreadBackgroundRunner');
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const error = Object.assign(new Error('runtime failed'), {
      params: { amount: 1n },
      payload: circular,
    });

    expect(JSON.parse(serializeWebEmbedBridgeError(error))).toEqual({
      ok: false,
      error: {
        name: 'WebEmbedBridgeResponseError',
        message: 'WebEmbed bridge response could not be serialized',
      },
    });
  });

  it('rejects a remote call when a legacy error contains constructorName', async () => {
    await import('./setupMainThreadBackgroundRunner');

    const transport = (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport?: {
          callServiceRequest: (
            request: {
              type: 'service-call';
              method: string;
              params: unknown[];
              sync: boolean;
            },
            localFallback: () => Promise<unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__onekeyNativeBackgroundThreadTransport;

    expect(transport).toBeDefined();
    expect(mockInboundMessageHandler).toBeDefined();

    const requestPromise = transport!.callServiceRequest(
      {
        type: 'service-call',
        method: 'servicePrime.apiRedeemPrimeCode',
        params: ['OK61451-INVALID-CODE'],
        sync: false,
      },
      () => Promise.resolve(undefined),
    );
    const requestCall = mockSharedRPCWrite.mock.calls.find(
      ([key]) => typeof key === 'string' && key.startsWith('onekey:bg:req:'),
    );
    const callId = (requestCall?.[0] as string).slice('onekey:bg:req:'.length);

    expect(() =>
      mockInboundMessageHandler?.(
        `onekey:bg:res:${callId}`,
        JSON.stringify({
          ok: false,
          error: {
            name: 'OneKeyServerApiError',
            message: '/prime/v1/account/profile Not Found',
            autoToast: true,
            className: 'OneKeyServerApiError',
            code: 404,
            constructorName: 'OneKeyServerApiError',
          },
        }),
      ),
    ).not.toThrow();

    await expect(requestPromise).rejects.toMatchObject({
      name: 'OneKeyServerApiError',
      message: '/prime/v1/account/profile Not Found',
      autoToast: true,
      className: 'OneKeyServerApiError',
      code: 404,
    });
  });

  it('rejects a hardware error response without touching getter-only constructorName (OK-61417)', async () => {
    await import('./setupMainThreadBackgroundRunner');

    const transport = (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport?: {
          callServiceRequest: (
            request: {
              type: 'service-call';
              method: string;
              params: unknown[];
              sync: boolean;
            },
            localFallback: () => Promise<unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__onekeyNativeBackgroundThreadTransport;

    const requestPromise = transport!.callServiceRequest(
      {
        type: 'service-call',
        method: 'serviceAccount.addHDOrHWAccounts',
        params: [{ walletId: 'hw-1', networkId: 'btc--0' }],
        sync: false,
      },
      () => Promise.resolve(undefined),
    );
    const requestCalls = mockSharedRPCWrite.mock.calls.filter(
      ([key]) => typeof key === 'string' && key.startsWith('onekey:bg:req:'),
    );
    const requestCall = requestCalls[requestCalls.length - 1];
    const callId = (requestCall?.[0] as string).slice('onekey:bg:req:'.length);
    const hardwarePayload = {
      code: 105,
      error: 'Device not found',
      connectId: 'ble-connect-id',
      deviceId: 'device-id',
    };

    // Shape of a hardware failure crossing the bridge after the BLE retries
    // give up on a powered-off device. Legacy background bundles still put
    // the constructorName getter value on the wire.
    expect(() =>
      mockInboundMessageHandler?.(
        `onekey:bg:res:${callId}`,
        JSON.stringify({
          ok: false,
          error: {
            name: 'DeviceNotFound',
            message: 'Device not found',
            className: 'DeviceNotFound',
            $isHardwareError: true,
            code: 105,
            key: 'hardware.device_not_find_error',
            autoToast: true,
            reconnect: true,
            payload: hardwarePayload,
            constructorName: 'DeviceNotFound',
          },
        }),
      ),
    ).not.toThrow();

    // A resolved call yields `undefined` here and fails the shape check below.
    const error = (await requestPromise.catch(
      (rejection: unknown) => rejection,
    )) as Error & Record<string, unknown>;
    expect(error).toMatchObject({
      name: 'DeviceNotFound',
      message: 'Device not found',
      className: 'DeviceNotFound',
      $isHardwareError: true,
      code: 105,
      key: 'hardware.device_not_find_error',
      autoToast: true,
      reconnect: true,
      payload: hardwarePayload,
    });
    // The getter stays on the prototype; the wire value must never be
    // written onto the instance.
    expect(
      Object.getOwnPropertyDescriptor(error, 'constructorName'),
    ).toBeUndefined();
    expect(error.constructorName).toBe('OneKeyLocalError');
  });

  it('continues rehydrating after an error metadata field fails', async () => {
    await import('./setupMainThreadBackgroundRunner');
    mockRejectErrorKeyAssignment = true;

    const transport = (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport?: {
          callServiceRequest: (
            request: {
              type: 'service-call';
              method: string;
              params: unknown[];
              sync: boolean;
            },
            localFallback: () => Promise<unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__onekeyNativeBackgroundThreadTransport;

    const requestPromise = transport!.callServiceRequest(
      {
        type: 'service-call',
        method: 'servicePrime.apiRedeemPrimeCode',
        params: ['OK61451-INVALID-CODE'],
        sync: false,
      },
      () => Promise.resolve(undefined),
    );
    const requestCalls = mockSharedRPCWrite.mock.calls.filter(
      ([key]) => typeof key === 'string' && key.startsWith('onekey:bg:req:'),
    );
    const requestCall = requestCalls[requestCalls.length - 1];
    const callId = (requestCall?.[0] as string).slice('onekey:bg:req:'.length);

    expect(() =>
      mockInboundMessageHandler?.(
        `onekey:bg:res:${callId}`,
        JSON.stringify({
          ok: false,
          error: {
            name: 'OneKeyServerApiError',
            message: '/prime/v1/account/profile Not Found',
            autoToast: true,
            className: 'OneKeyServerApiError',
            code: 404,
            key: 'server_error',
            info: { guessesRemaining: 4 },
            reconnect: false,
          },
        }),
      ),
    ).not.toThrow();

    await expect(requestPromise).rejects.toMatchObject({
      name: 'OneKeyServerApiError',
      message: '/prime/v1/account/profile Not Found',
      autoToast: true,
      className: 'OneKeyServerApiError',
      code: 404,
      key: 'onekey_error',
      info: { guessesRemaining: 4 },
      reconnect: false,
    });
    expect(mockNativeLoggerWrite).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('field=key'),
    );
  });

  it('rehydrates i18n error metadata from the background runtime', async () => {
    await import('./setupMainThreadBackgroundRunner');
    mockNativeLoggerWrite.mockClear();

    const transport = (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport?: {
          callServiceRequest: (
            request: {
              type: 'service-call';
              method: string;
              params: unknown[];
              sync: boolean;
            },
            localFallback: () => Promise<unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__onekeyNativeBackgroundThreadTransport;

    const requestPromise = transport!.callServiceRequest(
      {
        type: 'service-call',
        method: 'serviceKeylessWallet.verifyPin',
        params: [],
        sync: false,
      },
      () => Promise.resolve(undefined),
    );
    const requestCalls = mockSharedRPCWrite.mock.calls.filter(
      ([key]) => typeof key === 'string' && key.startsWith('onekey:bg:req:'),
    );
    const requestCall = requestCalls[requestCalls.length - 1];
    const callId = (requestCall?.[0] as string).slice('onekey:bg:req:'.length);

    mockInboundMessageHandler?.(
      `onekey:bg:res:${callId}`,
      JSON.stringify({
        ok: false,
        error: {
          name: 'IncorrectPinError',
          message: 'Incorrect PIN entered',
          className: 'IncorrectPinError',
          key: 'incorrect_pin',
          info: { guessesRemaining: 4 },
          reconnect: false,
        },
      }),
    );

    await expect(requestPromise).rejects.toMatchObject({
      name: 'IncorrectPinError',
      message: 'Incorrect PIN entered',
      className: 'IncorrectPinError',
      key: 'incorrect_pin',
      info: { guessesRemaining: 4 },
      reconnect: false,
    });
    expect(mockNativeLoggerWrite).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('errorName=IncorrectPinError'),
    );
    expect(mockNativeLoggerWrite).not.toHaveBeenCalledWith(
      'info',
      expect.stringContaining('guessesRemaining'),
    );
  });

  it('replays single and batched Jotai broadcasts after hydration', async () => {
    const {
      buildBackgroundThreadJotaiStateBatchKey,
      buildBackgroundThreadJotaiStateKey,
      serializeBackgroundThreadJotaiStateBroadcastBatchPayload,
      serializeBackgroundThreadJotaiStateBroadcastPayload,
    } = await import('./rpcProtocol');
    const { runJotaiMainHydration } = await import('./jotaiMainHydrationGate');
    let resolveInitialization!: () => void;
    const initializationPromise = new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    });
    mockJotaiUpdateFromUiByBgBroadcast.mockClear();

    const hydrationPromise = runJotaiMainHydration(() => initializationPromise);
    mockInboundMessageHandler?.(
      buildBackgroundThreadJotaiStateKey('1'),
      serializeBackgroundThreadJotaiStateBroadcastPayload({
        name: 'firstAtom',
        payload: 'first',
      }),
    );
    mockInboundMessageHandler?.(
      buildBackgroundThreadJotaiStateBatchKey('1'),
      serializeBackgroundThreadJotaiStateBroadcastBatchPayload({
        items: [
          { name: 'secondAtom', payload: 'second' },
          { name: 'thirdAtom', payload: 'third' },
        ],
      }),
    );

    expect(mockJotaiUpdateFromUiByBgBroadcast).not.toHaveBeenCalled();
    resolveInitialization();
    await hydrationPromise;

    expect(
      mockJotaiUpdateFromUiByBgBroadcast.mock.calls.map(
        ([params]) => params.name,
      ),
    ).toEqual(['firstAtom', 'secondAtom', 'thirdAtom']);
  });

  async function createRecoveryHarness(sequence: number) {
    await import('./setupMainThreadBackgroundRunner');
    const { registerImageEmbedBridge } =
      await import('@onekeyhq/shared/src/utils/imageUtils.embedBridge');
    const imageBridge = jest
      .mocked(registerImageEmbedBridge)
      .mock.calls.at(-1)![0];
    const transport = (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport: {
          syncBridgeConnection: (
            params: {
              channel: 'webEmbed';
              bridge: unknown;
              mountId: string;
              mountSequence: number;
            },
            fallback: () => Promise<unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__onekeyNativeBackgroundThreadTransport;
    const request = jest.fn().mockResolvedValue('recovered-image');
    const mount = (mountSequence: number) => {
      const mountId = `recovery-${mountSequence}`;
      mockAppEventHandlers.WebEmbedWebViewMountRequested({
        mountId,
        mountSequence,
      });
      void transport.syncBridgeConnection(
        {
          channel: 'webEmbed',
          bridge: { request, globalOnMessageEnabled: true },
          mountId,
          mountSequence,
        },
        async () => undefined,
      );
      return mountId;
    };
    const previousMount = mount(sequence);
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({
      mountId: previousMount,
    });
    void transport.syncBridgeConnection(
      {
        channel: 'webEmbed',
        bridge: null,
        mountId: previousMount,
        mountSequence: sequence,
      },
      async () => undefined,
    );
    mockAppEventEmit.mockClear();
    const settle = async () => {
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    };
    const cleanup = async () => {
      await settle();
      mockSharedRPCWrite.mock.calls
        .filter(
          ([key]) =>
            typeof key === 'string' && key.startsWith('onekey:bg:req:'),
        )
        .forEach(([key]) => {
          mockInboundMessageHandler?.(
            `onekey:bg:res:${(key as string).slice('onekey:bg:req:'.length)}`,
            JSON.stringify({ ok: true }),
          );
        });
      mockAppEventEmit.mockReset();
      mockSharedRPCWrite.mockClear();
    };
    return { imageBridge, request, mount, settle, cleanup };
  }

  it('replays an early image and reverse demand once when the provider subscribes', async () => {
    const { imageBridge, request, mount, settle, cleanup } =
      await createRecoveryHarness(1000);
    const first = imageBridge.convertToBlackAndWhiteImageBase64(
      'image',
      'image/png',
    );
    const second = imageBridge.convertToBlackAndWhiteImageBase64(
      'image',
      'image/png',
    );
    mockInboundMessageHandler?.('onekey:webembed:req:early-reverse', '{}');
    await settle();
    expect(mockAppEventEmit).toHaveBeenCalledTimes(1);
    let receivedMountId: string | undefined;
    mockAppEventEmit.mockImplementation((name: string) => {
      if (name === 'LoadWebEmbedWebView') receivedMountId = mount(1001);
    });
    mockAppEventHandlers.WebEmbedWebViewProviderReady?.({
      mainRuntimeId: 'live',
      probeId: 'passive-proof',
    });
    expect(mockAppEventEmit).toHaveBeenCalledTimes(1);
    mockAppEventHandlers.WebEmbedWebViewProviderReady?.(undefined);
    mockAppEventHandlers.WebEmbedWebViewProviderReady?.(undefined);
    const replayCount = mockAppEventEmit.mock.calls.length;
    const providerReceived = receivedMountId;
    receivedMountId ??= mount(1001);
    const third = imageBridge.convertToBlackAndWhiteImageBase64(
      'image',
      'image/png',
    );
    await settle();
    expect(request).not.toHaveBeenCalled();
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({
      mountId: receivedMountId,
    });
    await expect(first).resolves.toBe('recovered-image');
    await expect(second).resolves.toBe('recovered-image');
    await expect(third).resolves.toBe('recovered-image');
    await settle();
    const response = mockSharedRPCWrite.mock.calls.find(
      ([key]) => key === 'onekey:webembed:resp:early-reverse',
    )?.[1];
    const readyListeners =
      mockAppEventListeners.WebEmbedWebViewProviderReady?.size ?? 0;
    await cleanup();
    expect(providerReceived).toBe('recovery-1001');
    expect(replayCount).toBe(2);
    expect(request).toHaveBeenCalledTimes(4);
    expect(JSON.parse(response as string)).toEqual({
      ok: true,
      result: 'recovered-image',
    });
    expect(readyListeners).toBe(0);
  });

  it('cleans up an early recovery timeout so a later image demand can retry', async () => {
    jest.useFakeTimers();
    try {
      const { imageBridge, mount, settle, cleanup } =
        await createRecoveryHarness(2000);
      const first = imageBridge.convertToBlackAndWhiteImageBase64(
        'image',
        'image/png',
      );
      const firstRejection = first.catch((error: unknown) => error);
      mockInboundMessageHandler?.('onekey:webembed:req:early-timeout', '{}');
      await jest.advanceTimersByTimeAsync(30_000);
      await expect(firstRejection).resolves.toMatchObject({
        message: 'webEmbed not ready after 30s',
      });
      const listenersAfterTimeout =
        mockAppEventListeners.WebEmbedWebViewProviderReady?.size ?? 0;
      const reverseResponse = mockSharedRPCWrite.mock.calls.find(
        ([key]) => key === 'onekey:webembed:resp:early-timeout',
      )?.[1];
      mockAppEventEmit.mockClear();
      const retry = imageBridge.convertToBlackAndWhiteImageBase64(
        'image',
        'image/png',
      );
      await settle();
      let mounted: string | undefined;
      mockAppEventEmit.mockImplementation((name: string) => {
        if (name === 'LoadWebEmbedWebView') mounted = mount(2001);
      });
      mockAppEventHandlers.WebEmbedWebViewProviderReady?.(undefined);
      const replayedMount = mounted;
      mounted ??= mount(2001);
      mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: mounted });
      await expect(retry).resolves.toBe('recovered-image');
      await cleanup();
      expect(listenersAfterTimeout).toBe(0);
      expect(replayedMount).toBe('recovery-2001');
      expect(JSON.parse(reverseResponse as string)).toMatchObject({
        ok: false,
        error: { message: 'webEmbed not ready after 30s' },
      });
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('rebuilds an owned page once after a real background restart and waits for its new handshake', async () => {
    const { imageBridge, request, mount, settle, cleanup } =
      await createRecoveryHarness(3000);
    const oldMount = mount(3001);
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: oldMount });
    await cleanup();
    let replacement: string | undefined;
    mockAppEventEmit.mockImplementation((name: string) => {
      if (name === 'LoadWebEmbedWebView') replacement = mount(3002);
    });
    mockReadySignalPayload = JSON.stringify({
      ...JSON.parse(mockReadyPayload),
      bootId: 'new-background',
    });
    mockInboundMessageHandler?.(
      '@onekey/mobile/background-thread/runtime-ready-wake',
      '1',
    );
    mockInboundMessageHandler?.(
      '@onekey/mobile/background-thread/runtime-ready-wake',
      '1',
    );
    const loads = mockAppEventEmit.mock.calls.filter(
      ([name]) => name === 'LoadWebEmbedWebView',
    ).length;
    const pending = imageBridge.convertToBlackAndWhiteImageBase64(
      'image',
      'image/png',
    );
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: oldMount });
    await settle();
    expect(request).not.toHaveBeenCalled();
    replacement ??= mount(3002);
    mockAppEventHandlers.LoadWebEmbedWebViewComplete({ mountId: replacement });
    await expect(pending).resolves.toBe('recovered-image');
    await cleanup();
    expect(loads).toBe(1);
  });

  it('does not mount an undemanded page at cold startup or on background heartbeats', async () => {
    mockAppEventEmit.mockReset();
    await jest.isolateModulesAsync(async () => {
      await import('./setupMainThreadBackgroundRunner');
      mockInboundMessageHandler?.(
        '@onekey/mobile/background-thread/runtime-ready-wake',
        '1',
      );
      mockReadySignalPayload = JSON.stringify({
        ...JSON.parse(mockReadyPayload),
        bootId: 'idle-background',
      });
      mockInboundMessageHandler?.(
        '@onekey/mobile/background-thread/runtime-ready-wake',
        '1',
      );
      mockInboundMessageHandler?.(
        '@onekey/mobile/background-thread/runtime-ready-wake',
        '1',
      );
    });
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(0);
  });

  it.each(['ready', 'queued'])(
    'bounds an unanswered read-only inspection to 15 seconds when %s',
    async (state) => {
      jest.useFakeTimers();
      const readyPayload = mockReadySignalPayload;
      try {
        jest.resetModules();
        if (state === 'queued') mockReadySignalPayload = '';
        await import('./setupMainThreadBackgroundRunner');
        const call = (globalThis as INativeStorageGlobal)
          .__onekeyNativeStorageCall;
        expect(call).toBeDefined();
        let settled = false;
        const outcome = call!({
          scope: 'recovery',
          operation: 'inspectAppStorageMigration',
        }).catch((error: unknown) => {
          settled = true;
          return error;
        });
        jest.advanceTimersByTime(14_999);
        await Promise.resolve();
        expect(settled).toBe(false);
        jest.advanceTimersByTime(1);
        await expect(outcome).resolves.toMatchObject({
          message: expect.stringContaining('Background request timeout (15s)'),
        });
        if (state === 'ready') {
          // A single lost response does not break later probes or reuse its id.
          const retry = call!({
            scope: 'recovery',
            operation: 'inspectAppStorageMigration',
          });
          const calls = mockSharedRPCWrite.mock.calls.filter(
            ([key]) =>
              typeof key === 'string' && key.startsWith('onekey:bg:req:'),
          );
          const key = calls[calls.length - 1][0] as string;
          mockInboundMessageHandler?.(
            key.replace('onekey:bg:req:', 'onekey:bg:res:'),
            JSON.stringify({ ok: true, result: { errorMessage: null } }),
          );
          await expect(retry).resolves.toEqual({ errorMessage: null });
        }
      } finally {
        mockReadySignalPayload = readyPayload;
        jest.useRealTimers();
      }
    },
  );
});
