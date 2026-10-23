import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

const mockSharedRPCWrite = jest.fn();
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

const mockReadyPayload = JSON.stringify({
  runtime: 'background',
  status: 'ready',
  protocolVersion: '1',
  bootId: 'test-boot-id',
  ts: 1,
});

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
    get: () => mockReadyPayload,
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
  },
  appEventBus: {
    dispatchInboundFromBackground: jest.fn(),
    emit: jest.fn(),
    on: jest.fn((name: string, handler: (payload: any) => void) => {
      mockAppEventHandlers[name] = handler;
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
});
