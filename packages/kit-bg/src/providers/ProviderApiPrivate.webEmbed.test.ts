import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { markWebEmbedChannelPayload } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import ProviderApiPrivate from './ProviderApiPrivate';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, enableNativeBackgroundThread: false },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

function callReady(provider: ProviderApiPrivate, mountId: string) {
  return provider.handleMethods(
    markWebEmbedChannelPayload(
      {
        scope: '$private',
        origin: 'null',
        data: { method: 'webEmbedApiReady', params: [{ mountId }] },
      } as IJsBridgeMessagePayload,
      true,
    ),
  );
}

describe('WebEmbed page readiness ownership', () => {
  const previousBackgroundFlag = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundFlag;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    platformEnv.enableNativeBackgroundThread = false;
    appGlobals.$$webEmbedMainRuntime = undefined;
  });

  it('does not accept a ready callback from a torn-down page', async () => {
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    await provider.setWebEmbedApiNotReady();
    await callReady(provider, 'old-mount');

    expect(provider.isWebEmbedApiReady).toBe(false);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      expect.anything(),
    );
  });

  it('keeps only the current mount ready across timeout, retry, and late cleanup', async () => {
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    expect(provider.reserveWebEmbedRequest('request-a')).toEqual({
      ready: false,
    });
    expect(
      provider.activateWebEmbedMount({
        mountId: 'mount-a',
        mountSequence: 1,
        requestId: 'request-a',
      }),
    ).toBe(true);

    // The first wait timed out without tearing down its page.
    expect(provider.reserveWebEmbedRequest('request-b')).toEqual({
      ready: false,
    });
    await callReady(provider, 'mount-a');
    expect(provider.isWebEmbedApiReady).toBe(false);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      expect.anything(),
    );

    expect(
      provider.activateWebEmbedMount({
        mountId: 'mount-b',
        mountSequence: 2,
        requestId: 'request-b',
      }),
    ).toBe(true);
    await callReady(provider, 'mount-b');
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'mount-b',
    });
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      { mountId: 'mount-b', requestId: 'request-b' },
    );

    provider.deactivateWebEmbedMount('mount-a');
    expect(
      provider.activateWebEmbedMount({
        mountId: 'mount-a',
        mountSequence: 1,
        requestId: 'request-b',
      }),
    ).toBe(false);
    expect(
      provider.activateWebEmbedMount({
        mountId: 'mount-b',
        mountSequence: 2,
        requestId: 'request-b',
      }),
    ).toBe(true);
    expect(provider.isWebEmbedApiReady).toBe(true);
    await provider.setWebEmbedApiNotReady();
    expect(provider.isWebEmbedApiReady).toBe(true);
  });

  it('only accepts not-ready from the active page and broadcasts its owner', async () => {
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    const emitSpy = jest.spyOn(appEventBus, 'emit');
    const request = markWebEmbedChannelPayload(
      {
        scope: '$private',
        origin: 'null',
        data: { method: 'webEmbedApiNotReady' },
      } as IJsBridgeMessagePayload,
      true,
    );
    provider.activateWebEmbedMount({ mountId: 'current', mountSequence: 2 });
    await callReady(provider, 'current');
    await provider.webEmbedApiNotReady(request, { mountId: 'old' });
    expect(provider.isWebEmbedApiReady).toBe(true);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EAppEventBusNames.WebEmbedWebViewNotReady,
      expect.anything(),
    );
    await provider.webEmbedApiNotReady(request, { mountId: 'current' });
    expect(provider.isWebEmbedApiReady).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.WebEmbedWebViewNotReady,
      { mountId: 'current' },
    );
    await callReady(provider, 'current');
    expect(provider.isWebEmbedApiReady).toBe(true);
  });

  it('binds a legacy rebuild to a pending background request', async () => {
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    provider.reserveWebEmbedRequest('request-b');
    expect(
      provider.activateWebEmbedMount({
        mountId: 'legacy-mount',
        mountSequence: 3,
      }),
    ).toBe(true);
    await callReady(provider, 'legacy-mount');

    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      { mountId: 'legacy-mount', requestId: 'request-b' },
    );
  });

  it('adopts an in-flight unowned mount when a background request reserves after activation', async () => {
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    const emitSpy = jest.spyOn(appEventBus, 'emit');

    expect(
      provider.activateWebEmbedMount({
        mountId: 'unowned-in-flight',
        mountSequence: 1,
      }),
    ).toBe(true);
    expect(provider.reserveWebEmbedRequest('request-1')).toEqual({
      ready: false,
    });
    await callReady(provider, 'unowned-in-flight');

    expect(emitSpy).toHaveBeenCalledWith(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      { mountId: 'unowned-in-flight', requestId: 'request-1' },
    );
  });

  it('does not invalidate a page that became ready before reservation', async () => {
    const provider = new ProviderApiPrivate({ backgroundApi: {} });

    provider.reserveWebEmbedRequest('request-a');
    provider.activateWebEmbedMount({
      mountId: 'mount-a',
      mountSequence: 1,
      requestId: 'request-a',
    });
    await callReady(provider, 'mount-a');

    expect(provider.reserveWebEmbedRequest('request-b')).toEqual({
      ready: true,
    });
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'mount-a',
    });
  });

  it('accepts a restarted main first mount and rejects the retired owner without cleanup', async () => {
    platformEnv.enableNativeBackgroundThread = true;
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    appGlobals.$$webEmbedMainRuntime = {
      currentRuntimeId: 'main-a',
      retiredRuntimeIds: new Set(),
    };
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-a-5', mountSequence: 5 }),
    ).toBe(true);
    await callReady(provider, 'main-a-5');
    expect(provider.getWebEmbedApiReadyState().ready).toBe(true);
    appGlobals.$$webEmbedMainRuntime.currentRuntimeId = 'main-b';
    appGlobals.$$webEmbedMainRuntime.retiredRuntimeIds.add('main-a');
    expect(provider.getWebEmbedApiReadyState().ready).toBe(false);
    provider.reserveWebEmbedRequest('request-b');
    expect(
      provider.activateWebEmbedMount({
        mountId: 'main-b-1',
        mountSequence: 1,
        requestId: 'request-b',
      }),
    ).toBe(true);
    await callReady(provider, 'main-b-1');
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-a-6', mountSequence: 6 }),
    ).toBe(false);
    await callReady(provider, 'main-a-5');
    provider.deactivateWebEmbedMount('main-a-5');
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'main-b-1',
    });
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-b-1', mountSequence: 1 }),
    ).toBe(true);
    expect(provider.getWebEmbedApiReadyState().ready).toBe(true);
  });

  it('does not let an unannounced runtime replace the active page', async () => {
    platformEnv.enableNativeBackgroundThread = true;
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-a-5', mountSequence: 5 }),
    ).toBe(true);
    await callReady(provider, 'main-a-5');
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-b-6', mountSequence: 6 }),
    ).toBe(false);
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'main-a-5',
    });
    expect(
      provider.activateWebEmbedMount({ mountId: 'main-a-6', mountSequence: 6 }),
    ).toBe(true);
    expect(
      provider.activateWebEmbedMount({ mountId: 'forged-7', mountSequence: 7 }),
    ).toBe(false);
  });

  it('keeps single-runtime mount ordering independent of native epochs', async () => {
    const provider = new ProviderApiPrivate({ backgroundApi: {} });
    appGlobals.$$webEmbedMainRuntime = {
      currentRuntimeId: 'unrelated',
      retiredRuntimeIds: new Set(['legacy']),
    };
    expect(
      provider.activateWebEmbedMount({ mountId: 'legacy', mountSequence: 1 }),
    ).toBe(true);
    await callReady(provider, 'legacy');
    expect(provider.getWebEmbedApiReadyState()).toEqual({
      ready: true,
      mountId: 'legacy',
    });
  });

  it('gates direct fallback calls on the new epoch and bridge owner', async () => {
    jest.useFakeTimers();
    try {
      platformEnv.enableNativeBackgroundThread = true;
      const request = jest.fn().mockResolvedValue('new-image');
      let bridgeOwner = 'main-a-5';
      const backgroundApi = {
        webEmbedBridge: { request, remoteInfo: { origin: 'null' } },
        isWebEmbedBridgeOwnedBy: (mountId?: string) => mountId === bridgeOwner,
      };
      const provider = new ProviderApiPrivate({ backgroundApi });
      appGlobals.$$webEmbedMainRuntime = {
        currentRuntimeId: 'main-a',
        retiredRuntimeIds: new Set(),
      };
      provider.activateWebEmbedMount({ mountId: 'main-a-5', mountSequence: 5 });
      await callReady(provider, 'main-a-5');
      appGlobals.$$webEmbedMainRuntime.currentRuntimeId = 'main-b';
      const pending = provider.callWebEmbedApiProxy({
        module: 'imageUtils',
        method: 'base64ImageToBitmap',
        params: [],
      });
      await jest.advanceTimersByTimeAsync(1000);
      expect(request).not.toHaveBeenCalled();
      provider.activateWebEmbedMount({ mountId: 'main-b-1', mountSequence: 1 });
      bridgeOwner = 'main-b-1';
      await callReady(provider, 'main-b-1');
      await jest.advanceTimersByTimeAsync(1000);
      await expect(pending).resolves.toBe('new-image');
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('rechecks the epoch after direct fallback waiting completes', async () => {
    platformEnv.enableNativeBackgroundThread = true;
    const request = jest.fn();
    const backgroundApi = {
      webEmbedBridge: { request, remoteInfo: { origin: 'null' } },
      isWebEmbedBridgeOwnedBy: () => {
        appGlobals.$$webEmbedMainRuntime!.currentRuntimeId = 'main-b';
        return true;
      },
    };
    const provider = new ProviderApiPrivate({ backgroundApi });
    appGlobals.$$webEmbedMainRuntime = {
      currentRuntimeId: 'main-a',
      retiredRuntimeIds: new Set(),
    };
    provider.activateWebEmbedMount({ mountId: 'main-a-5', mountSequence: 5 });
    await callReady(provider, 'main-a-5');
    await expect(
      provider.callWebEmbedApiProxy({
        module: 'imageUtils',
        method: 'base64ImageToBitmap',
        params: [],
      }),
    ).rejects.toThrow('webembed webview bridge not ready.');
    expect(request).not.toHaveBeenCalled();
  });
});
