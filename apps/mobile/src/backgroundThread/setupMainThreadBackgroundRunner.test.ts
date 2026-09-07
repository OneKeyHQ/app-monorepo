import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

const mockSharedRPCWrite = jest.fn();
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
  default: {},
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    LoadWebEmbedWebView: 'LoadWebEmbedWebView',
    LoadWebEmbedWebViewComplete: 'LoadWebEmbedWebViewComplete',
  },
  appEventBus: {
    dispatchInboundFromBackground: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
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
  });

  afterAll(() => {
    delete (
      globalThis as typeof globalThis & {
        __onekeyNativeBackgroundThreadTransport?: unknown;
      }
    ).__onekeyNativeBackgroundThreadTransport;
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
