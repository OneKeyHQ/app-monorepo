import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { XMR_SYNC_WATCHDOG_MS } from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { IncorrectPinError } from '@onekeyhq/shared/src/errors/errors/appErrors';
import { DeviceNotFound } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const mockSharedRPCWrite = jest.fn();
const mockSharedRPCRegisterReadinessKey = jest.fn();
const mockSharedStoreGet = jest.fn();
const mockSharedStoreSet = jest.fn();
const mockNativeLoggerWrite = jest.fn();
const mockAppEventEmit = jest.fn();
const mockDispatchFromForeground = jest.fn();

let mockInboundMessageHandler:
  | ((key: string, value: string | number | boolean) => void)
  | undefined;

function dispatchServiceRequest(callId: string) {
  mockInboundMessageHandler?.(
    `onekey:bg:req:${callId}`,
    JSON.stringify({
      type: 'service-call',
      method: 'servicePrime.apiRedeemPrimeCode',
      params: ['OK61451-INVALID-CODE'],
      sync: false,
    }),
  );
}

async function flushRequest() {
  await Promise.resolve();
  await Promise.resolve();
}

function getResponse(callId: string): unknown {
  const responseKey = `onekey:bg:res:${callId}`;
  const responseWrites = mockSharedRPCWrite.mock.calls.filter(
    ([key]) => key === responseKey,
  );
  return JSON.parse(
    responseWrites[responseWrites.length - 1]?.[1] as string,
  ) as unknown;
}

const fallbackResponse = {
  ok: false,
  error: {
    name: 'BackgroundThreadResponseError',
    message: 'Background response failed',
  },
};

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
    get: mockSharedStoreGet,
    set: mockSharedStoreSet,
  }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, enableNativeBackgroundThread: true },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: class MockOneKeyLocalError extends Error {},
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    WebEmbedWebViewProviderReady: 'WebEmbedWebViewProviderReady',
    LoadWebEmbedWebView: 'LoadWebEmbedWebView',
    LoadWebEmbedWebViewComplete: 'LoadWebEmbedWebViewComplete',
    WebEmbedWebViewNotReady: 'WebEmbedWebViewNotReady',
    WebEmbedWebViewRuntimeProbe: 'WebEmbedWebViewRuntimeProbe',
  },
  appEventBus: {
    emit: mockAppEventEmit,
    dispatchInboundFromForeground: mockDispatchFromForeground,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      webembed: { webembedApiReady: jest.fn(), webembedApiNotReady: jest.fn() },
      eventBus: {
        missingOriginNodeId: jest.fn(),
      },
    },
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    LogLevel: { Error: 'error', Info: 'info' },
    NativeLogger: { write: mockNativeLoggerWrite },
  }),
);

describe('background thread RPC handler', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockAppEventEmit.mockReset();
    mockDispatchFromForeground.mockClear();
    mockSharedStoreGet.mockReset();
    appGlobals.$$webEmbedMainRuntime = undefined;
  });

  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('lets a Monero scan step run as long as its turn watchdog', async () => {
    const { getWebEmbedBridgeCallTimeoutMs } =
      await import('./setupBackgroundThreadRPCHandler');

    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'chainXmr',
        method: 'syncStep',
      }),
    ).toBe(XMR_SYNC_WATCHDOG_MS);
    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'chainXmr',
        method: 'prepareTransaction',
      }),
    ).toBeGreaterThan(30_000);
  });

  it('keeps Zcash sync and broadcast deadlines outside their inner watchdogs', async () => {
    const { getWebEmbedBridgeCallTimeoutMs } =
      await import('./setupBackgroundThreadRPCHandler');

    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'chainZcash',
        method: 'syncWallet',
      }),
    ).toBe(360_000);
    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'chainZcash',
        method: 'submitPczt',
      }),
    ).toBe(360_000);
    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'chainZcash',
        method: 'prepareWalletAccounts',
      }),
    ).toBe(360_000);
    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'chainZcash',
        method: 'purgeWallet',
      }),
    ).toBe(360_000);
    for (const method of ['quotePczt', 'createPczt', 'releasePczt']) {
      expect(
        getWebEmbedBridgeCallTimeoutMs({ module: 'chainZcash', method }),
      ).toBe(360_000);
    }
    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'chainZcash',
        method: 'provePczt',
      }),
    ).toBe(540_000);
    expect(
      getWebEmbedBridgeCallTimeoutMs({
        module: 'imageUtils',
        method: 'resize',
      }),
    ).toBe(30_000);
  });

  it('rehydrates structured runtime errors from WebEmbed', async () => {
    const { rehydrateWebEmbedBridgeError } =
      await import('./setupBackgroundThreadRPCHandler');
    const payload = {
      code: 'INSUFFICIENT_FUNDS',
      params: { shortfallZat: 20_000 },
      detail: 'proposal failed',
    };

    const error = rehydrateWebEmbedBridgeError(
      {
        name: 'RuntimeError',
        message: 'INSUFFICIENT_FUNDS',
        code: 'INSUFFICIENT_FUNDS',
        payload,
      },
      'chainZcash',
    );

    expect(error).toMatchObject({
      name: 'RuntimeError',
      message: 'INSUFFICIENT_FUNDS',
      code: 'INSUFFICIENT_FUNDS',
      payload,
    });
  });

  it('keeps message-only errors for other WebEmbed modules', async () => {
    const { rehydrateWebEmbedBridgeError } =
      await import('./setupBackgroundThreadRPCHandler');

    const error = rehydrateWebEmbedBridgeError(
      {
        name: 'RuntimeError',
        message: 'sign failed',
        code: 'X',
        autoToast: true,
      },
      'chainKaspa',
    );

    expect(error.message).toBe('sign failed');
    expect(error).not.toHaveProperty('code', 'X');
    expect(error.autoToast).not.toBe(true);
  });

  it('namespaces reverse WebEmbed call IDs by background boot', async () => {
    const { callWebEmbedBridgeViaMainThread } =
      await import('./setupBackgroundThreadRPCHandler');
    mockSharedRPCWrite.mockClear();

    const resultPromise = callWebEmbedBridgeViaMainThread({
      module: 'chainZcash',
      method: 'getBalance',
    });
    const request = mockSharedRPCWrite.mock.calls.find(
      ([key]) =>
        typeof key === 'string' && key.startsWith('onekey:webembed:req:'),
    );
    const callId = (request?.[0] as string).slice(
      'onekey:webembed:req:'.length,
    );
    expect(callId).toMatch(/^[^:]+:\d+$/);

    mockInboundMessageHandler?.(
      `onekey:webembed:resp:${callId}`,
      JSON.stringify({ ok: true, result: 'ok' }),
    );
    await expect(resultPromise).resolves.toBe('ok');
  });

  it('fails pending WebEmbed calls when the WebView is remounted', async () => {
    const {
      callWebEmbedBridgeViaMainThread,
      rejectPendingWebEmbedBridgeCalls,
    } = await import('./setupBackgroundThreadRPCHandler');

    const resultPromise = callWebEmbedBridgeViaMainThread({
      module: 'chainZcash',
      method: 'provePczt',
    });
    rejectPendingWebEmbedBridgeCalls('remounted');

    await expect(resultPromise).rejects.toThrow('remounted');
  });

  it('writes a minimal error response when the original error is not serializable', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    const error = new OneKeyLocalError('Original error') as Error & {
      payload?: unknown;
    };
    error.payload = { value: 1n };
    setBackgroundThreadRequestExecutor(() => Promise.reject(error));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('1');
    await flushRequest();

    expect(getResponse('1')).toEqual(fallbackResponse);
  });

  it('writes a minimal error response when reading error metadata fails', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    const error = new OneKeyLocalError('Original error');
    Object.defineProperty(error, 'message', {
      get: () => {
        throw new OneKeyLocalError('Message getter failed');
      },
    });
    setBackgroundThreadRequestExecutor(() => Promise.reject(error));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('2');
    await flushRequest();

    expect(getResponse('2')).toEqual(fallbackResponse);
  });

  it('serializes i18n error metadata with the shared plain-error contract', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    const error = Object.assign(
      new IncorrectPinError({
        message: 'Incorrect PIN entered',
        info: { guessesRemaining: 4 },
      }),
      { reconnect: false },
    );
    setBackgroundThreadRequestExecutor(() => Promise.reject(error));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('info');
    await flushRequest();

    const response = getResponse('info');
    expect(response).toMatchObject({
      ok: false,
      error: {
        name: 'IncorrectPinError',
        message: 'Incorrect PIN entered',
        className: 'IncorrectPinError',
        key: ETranslations.incorrect_pin,
        info: { guessesRemaining: 4 },
        reconnect: false,
      },
    });
    expect(response).not.toHaveProperty('error.stack');
  });

  it('serializes a hardware error without the getter-only constructorName (OK-61417)', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    const hardwarePayload = {
      code: HardwareErrorCode.DeviceNotFound,
      error: 'Device not found',
      connectId: 'ble-connect-id',
      deviceId: 'device-id',
    };
    const error = new DeviceNotFound({
      payload: hardwarePayload,
      silentMode: true,
    });
    setBackgroundThreadRequestExecutor(() => Promise.reject(error));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('hardware');
    await flushRequest();

    const response = getResponse('hardware');
    expect(response).toMatchObject({
      ok: false,
      error: {
        className: EOneKeyErrorClassNames.DeviceNotFound,
        $isHardwareError: true,
        code: HardwareErrorCode.DeviceNotFound,
        key: ETranslations.hardware_device_not_find_error,
        payload: hardwarePayload,
        reconnect: true,
      },
    });
    // constructorName is a getter-only accessor on the main-runtime error
    // classes; serializing it invited the rehydration TypeError that hung
    // the create-address flow.
    expect(response).not.toHaveProperty('error.constructorName');
    expect(response).not.toHaveProperty('error.stack');
  });

  it('serializes a nullish rejection without falling back', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    // Third-party and native APIs can reject without an Error object.
    // oxlint-disable-next-line prefer-promise-reject-errors
    setBackgroundThreadRequestExecutor(() => Promise.reject(undefined));
    mockSharedRPCWrite.mockClear();

    dispatchServiceRequest('undefined-error');
    await flushRequest();

    expect(getResponse('undefined-error')).toEqual({
      ok: false,
      error: {
        name: 'UnknownEmptyError',
        message: 'Unknown empty error',
      },
    });
  });

  it('retries a failed response write with the minimal error response', async () => {
    const { setBackgroundThreadRequestExecutor } =
      await import('./setupBackgroundThreadRPCHandler');
    setBackgroundThreadRequestExecutor(() => Promise.resolve({ value: 1 }));
    mockSharedRPCWrite.mockClear();
    mockSharedRPCWrite.mockImplementationOnce(() => {
      throw new OneKeyLocalError('Native write failed');
    });

    dispatchServiceRequest('3');
    await flushRequest();

    expect(getResponse('3')).toEqual(fallbackResponse);
  });

  async function providerReady(mainRuntimeId: string, probeId?: string) {
    mockInboundMessageHandler?.(
      `onekey:bg:req:provider-${mainRuntimeId}`,
      JSON.stringify({
        type: 'app-event',
        eventName: 'WebEmbedWebViewProviderReady',
        payload: { mainRuntimeId, ...(probeId ? { probeId } : {}) },
        originNodeId: mainRuntimeId,
      }),
    );
    await flushRequest();
  }

  it('retires the old UI epoch on a capability wake without accepting late advertisements', async () => {
    await import('./setupBackgroundThreadRPCHandler');
    const { default: ProviderApiPrivate } =
      await import('@onekeyhq/kit-bg/src/providers/ProviderApiPrivate');
    const { markWebEmbedChannelPayload } =
      await import('@onekeyhq/shared/src/utils/webEmbedChannelUtils');
    appGlobals.$$webEmbedMainRuntime = undefined;
    mockAppEventEmit.mockReset();
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'main-a' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    const ready = markWebEmbedChannelPayload(
      {
        origin: 'null',
        scope: '$private',
      } as import('@onekeyfe/cross-inpage-provider-types').IJsBridgeMessagePayload,
      true,
    );
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-a-5', mountSequence: 5 }),
    ).toBe(true);
    await provider.webEmbedApiReady(ready, { mountId: 'main-a-5' });
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'main-b' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    expect(provider.getWebEmbedApiReadyState().ready).toBe(false);
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-b-1', mountSequence: 1 }),
    ).toBe(true);
    await provider.webEmbedApiReady(ready, { mountId: 'main-b-1' });
    mockAppEventEmit.mockClear();
    await providerReady('main-b');
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'main-a' }),
    );
    await providerReady('main-a');
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-a-6', mountSequence: 6 }),
    ).toBe(false);
    await provider.webEmbedApiReady(ready, { mountId: 'main-a-5' });
    await provider.webEmbedApiNotReady(ready, { mountId: 'main-a-5' });
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'main-b-1',
    });
    expect(mockAppEventEmit).not.toHaveBeenCalledWith(
      'LoadWebEmbedWebView',
      undefined,
    );
    mockSharedStoreGet.mockReset();
    appGlobals.$$webEmbedMainRuntime = undefined;
  });

  it('recovers a rejected first activation only after its real provider epoch is trusted', async () => {
    await import('./setupBackgroundThreadRPCHandler');
    const { default: ProviderApiPrivate } =
      await import('@onekeyhq/kit-bg/src/providers/ProviderApiPrivate');
    const { markWebEmbedChannelPayload } =
      await import('@onekeyhq/shared/src/utils/webEmbedChannelUtils');
    appGlobals.$$webEmbedMainRuntime = undefined;
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'main-a' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    provider.reserveWebEmbedRequest('pending-b');
    expect(
      provider.activateWebEmbedMount({
        mountId: 'main-a-5',
        mountSequence: 5,
        requestId: 'pending-b',
      }),
    ).toBe(true);
    expect(
      provider.activateWebEmbedMount({
        mountId: 'main-b-1',
        mountSequence: 1,
        requestId: 'wrong-request',
      }),
    ).toBe(false);
    expect(
      provider.activateWebEmbedMount({
        mountId: 'main-b-1',
        mountSequence: 1,
        requestId: 'pending-b',
      }),
    ).toBe(false);
    const ready = markWebEmbedChannelPayload(
      {
        origin: 'null',
        scope: '$private',
      } as import('@onekeyfe/cross-inpage-provider-types').IJsBridgeMessagePayload,
      true,
    );
    let rebuiltReady: Promise<void> | undefined;
    mockAppEventEmit
      .mockReset()
      .mockImplementation((name: string, payload?: { probeId: string }) => {
        if (name === 'WebEmbedWebViewRuntimeProbe' && payload) {
          void providerReady('main-b', payload.probeId);
        }
        if (name === 'LoadWebEmbedWebView') {
          expect(
            provider.activateWebEmbedMount({
              mountId: 'main-b-2',
              mountSequence: 2,
            }),
          ).toBe(true);
          rebuiltReady = provider.webEmbedApiReady(ready, {
            mountId: 'main-b-2',
          });
        }
      });
    await providerReady('main-b');
    expect(mockAppEventEmit).not.toHaveBeenCalledWith(
      'LoadWebEmbedWebView',
      undefined,
    );
    mockSharedStoreGet.mockReturnValue(undefined);
    await providerReady('main-b');
    await rebuiltReady;
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'main-b-2',
    });
    expect(mockAppEventEmit).toHaveBeenCalledWith(
      'LoadWebEmbedWebViewComplete',
      { mountId: 'main-b-2', requestId: 'pending-b' },
    );
    await providerReady('main-b');
    await providerReady('main-a');
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'main-b' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(1);
    mockAppEventEmit.mockReset();
    mockSharedStoreGet.mockReset();
    appGlobals.$$webEmbedMainRuntime = undefined;
  });

  it('establishes a provider-first epoch without mounting an undemanded page', async () => {
    await import('./setupBackgroundThreadRPCHandler');
    const { default: ProviderApiPrivate } =
      await import('@onekeyhq/kit-bg/src/providers/ProviderApiPrivate');
    appGlobals.$$webEmbedMainRuntime = undefined;
    mockSharedStoreGet.mockReturnValue(undefined);
    mockAppEventEmit.mockReset();
    await providerReady('provider-first');
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    expect(
      provider.activateWebEmbedMount({
        mountId: 'provider-first-1',
        mountSequence: 1,
      }),
    ).toBe(true);
    expect(mockAppEventEmit).not.toHaveBeenCalledWith(
      'LoadWebEmbedWebView',
      undefined,
    );
    appGlobals.$$webEmbedMainRuntime = undefined;
    mockSharedStoreGet.mockReset();
  });

  it('retains a rejected current demand when a different unknown runtime activates late', async () => {
    await import('./setupBackgroundThreadRPCHandler');
    const { default: ProviderApiPrivate } =
      await import('@onekeyhq/kit-bg/src/providers/ProviderApiPrivate');
    appGlobals.$$webEmbedMainRuntime = undefined;
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'main-a' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    provider.reserveWebEmbedRequest('current-request');
    expect(
      provider.activateWebEmbedMount({
        mountId: 'main-c-1',
        mountSequence: 1,
        requestId: 'current-request',
      }),
    ).toBe(false);
    expect(
      provider.activateWebEmbedMount({
        mountId: 'main-b-1',
        mountSequence: 1,
        requestId: 'current-request',
      }),
    ).toBe(false);
    mockAppEventEmit.mockReset().mockImplementation((name: string) => {
      if (name === 'LoadWebEmbedWebView')
        expect(
          provider.activateWebEmbedMount({
            mountId: 'main-c-2',
            mountSequence: 2,
            requestId: 'current-request',
          }),
        ).toBe(true);
    });
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'main-c' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(1);
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(1);
    mockAppEventEmit.mockReset();
    mockSharedStoreGet.mockReset();
    appGlobals.$$webEmbedMainRuntime = undefined;
  });

  async function readyEpoch(runtimeId: string) {
    await import('./setupBackgroundThreadRPCHandler');
    const { default: ProviderApiPrivate } =
      await import('@onekeyhq/kit-bg/src/providers/ProviderApiPrivate');
    const { markWebEmbedChannelPayload } =
      await import('@onekeyhq/shared/src/utils/webEmbedChannelUtils');
    appGlobals.$$webEmbedMainRuntime = undefined;
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: runtimeId }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    provider.activateWebEmbedMount({
      mountId: `${runtimeId}-5`,
      mountSequence: 5,
    });
    const ready = markWebEmbedChannelPayload(
      {
        origin: 'null',
        scope: '$private',
      } as import('@onekeyfe/cross-inpage-provider-types').IJsBridgeMessagePayload,
      true,
    );
    await provider.webEmbedApiReady(ready, { mountId: `${runtimeId}-5` });
    mockAppEventEmit.mockReset();
    mockSharedStoreGet.mockReturnValue(undefined);
    return { provider, ready };
  }

  function latestProbeId(): string | undefined {
    return (
      mockAppEventEmit.mock.calls
        .filter(([name]) => name === 'WebEmbedWebViewRuntimeProbe')
        .at(-1)?.[1] as { probeId?: string } | undefined
    )?.probeId;
  }

  it('probes the live provider instead of accepting a never-adopted stale UI announcement', async () => {
    const { provider } = await readyEpoch('live-c');
    mockAppEventEmit.mockImplementation(
      (name: string, payload: { probeId: string }) => {
        if (name === 'WebEmbedWebViewRuntimeProbe')
          void providerReady('live-c', payload.probeId);
      },
    );
    await providerReady('stale-b');
    await flushRequest();
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'live-c-5',
    });
    const probeId = latestProbeId();
    expect(probeId).toEqual(expect.any(String));
    const dispatchCount = mockDispatchFromForeground.mock.calls.length;
    await providerReady('stale-b', probeId);
    expect(mockDispatchFromForeground).toHaveBeenCalledTimes(dispatchCount);
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'live-c-5',
    });
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(0);
  });

  it('accepts only the latest live probe proof and remounts a rejected current demand once', async () => {
    const { provider, ready } = await readyEpoch('old-a');
    await provider.setWebEmbedApiNotReady('old-a-5');
    provider.reserveWebEmbedRequest('request-b');
    expect(
      provider.activateWebEmbedMount({
        mountId: 'live-b-1',
        mountSequence: 1,
        requestId: 'request-b',
      }),
    ).toBe(false);
    mockAppEventEmit.mockReset();
    await providerReady('live-b');
    const firstProbe = latestProbeId();
    expect(firstProbe).toEqual(expect.any(String));
    await providerReady('late-c');
    const secondProbe = latestProbeId();
    expect(secondProbe).not.toBe(firstProbe);
    await providerReady('live-b', firstProbe);
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(0);
    let rebuilt: Promise<void> | undefined;
    mockAppEventEmit.mockImplementation((name: string) => {
      if (name === 'LoadWebEmbedWebView') {
        expect(
          provider.activateWebEmbedMount({
            mountId: 'live-b-2',
            mountSequence: 2,
            requestId: 'request-b',
          }),
        ).toBe(true);
        rebuilt = provider.webEmbedApiReady(ready, { mountId: 'live-b-2' });
      }
    });
    const dispatchCount = mockDispatchFromForeground.mock.calls.length;
    await providerReady('live-b', secondProbe);
    await rebuilt;
    await providerReady('late-c', secondProbe);
    await providerReady('old-a', secondProbe);
    expect(mockDispatchFromForeground).toHaveBeenCalledTimes(dispatchCount);
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'live-b-2',
    });
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(1);
    await providerReady('another-d');
    const liveProbe = latestProbeId();
    const dispatchesBeforeProof = mockDispatchFromForeground.mock.calls.length;
    await providerReady('old-a', liveProbe);
    await providerReady('live-b', liveProbe);
    expect(mockDispatchFromForeground).toHaveBeenCalledTimes(
      dispatchesBeforeProof,
    );
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'live-b-2',
    });
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(1);
  });

  it('invalidates pending probe proof on authoritative capability confirmation', async () => {
    const { provider } = await readyEpoch('live-c');
    await providerReady('stale-b');
    const probeId = latestProbeId();
    expect(probeId).toEqual(expect.any(String));
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'live-c' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    const dispatchCount = mockDispatchFromForeground.mock.calls.length;
    await providerReady('stale-b', probeId);
    await providerReady('stale-b', 'previous-background-probe');
    expect(mockDispatchFromForeground).toHaveBeenCalledTimes(dispatchCount);
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'live-c-5',
    });
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'WebEmbedWebViewRuntimeProbe',
      ),
    ).toHaveLength(1);
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(0);
  });

  it('keeps a live probe valid when a retired capability announcement arrives late', async () => {
    const { provider, ready } = await readyEpoch('retired-a');
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'current-c' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    provider.activateWebEmbedMount({
      mountId: 'current-c-1',
      mountSequence: 1,
    });
    await provider.webEmbedApiReady(ready, { mountId: 'current-c-1' });
    mockSharedStoreGet.mockReturnValue(undefined);
    expect(
      provider.activateWebEmbedMount({ mountId: 'live-d-1', mountSequence: 1 }),
    ).toBe(false);
    mockAppEventEmit.mockReset();
    await providerReady('live-d');
    const probeId = latestProbeId();
    expect(probeId).toEqual(expect.any(String));
    mockSharedStoreGet.mockReturnValue(
      JSON.stringify({ mainRuntimeId: 'retired-a' }),
    );
    mockInboundMessageHandler?.('onekey:bg:main-caps-wake', '1');
    let rebuilt: Promise<void> | undefined;
    mockAppEventEmit.mockImplementation((name: string) => {
      if (name === 'LoadWebEmbedWebView') {
        expect(
          provider.activateWebEmbedMount({
            mountId: 'live-d-2',
            mountSequence: 2,
          }),
        ).toBe(true);
        rebuilt = provider.webEmbedApiReady(ready, { mountId: 'live-d-2' });
      }
    });
    await providerReady('live-d', probeId);
    await rebuilt;
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'live-d-2',
    });
    expect(
      mockAppEventEmit.mock.calls.filter(
        ([name]) => name === 'LoadWebEmbedWebView',
      ),
    ).toHaveLength(1);
  });
});
