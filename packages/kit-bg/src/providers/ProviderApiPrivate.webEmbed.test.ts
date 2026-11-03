import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { markWebEmbedChannelPayload } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import ProviderApiPrivate from './ProviderApiPrivate';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

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
});
