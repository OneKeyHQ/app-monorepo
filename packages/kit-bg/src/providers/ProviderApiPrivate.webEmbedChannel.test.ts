import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { markWebEmbedChannelPayload } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import { createPrivacyChainFetchStreamRelay } from '../utils/privacyChainNodeRelay';

import ProviderApiPrivate from './ProviderApiPrivate';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('./ProviderApiBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/core/src/secret', () => ({
  getBgSensitiveTextEncodeKey: () => 'encode-key',
}));
jest.mock('../utils/privacyChainRelayTargets', () => ({
  createPrivacyChainRelayTargetSource: () => ({}),
}));
const streamRelay = jest.fn(async () => ({ ok: true, cancelled: true }));
jest.mock('../utils/privacyChainNodeRelay', () => ({
  createPrivacyChainFetchStreamRelay: jest.fn(() => streamRelay),
}));

const page = (origin: string): IJsBridgeMessagePayload =>
  ({
    origin,
    scope: '$private',
    data: { method: 'fetchStream' },
  }) as IJsBridgeMessagePayload;

const streamOpen = {
  action: 'open' as const,
  url: 'http://192.168.1.1/admin',
  method: 'POST',
  headers: [] as [string, string][],
};

function setup() {
  return new ProviderApiPrivate({ backgroundApi: {} });
}

describe('ProviderApiPrivate web-embed-only methods on native', () => {
  beforeEach(() => {
    streamRelay.mockClear();
  });

  it('builds the stream relay against configured nodes', () => {
    setup();
    expect(createPrivacyChainFetchStreamRelay).toHaveBeenCalled();
  });

  it.each([
    ['dApp data: iframe', page('null')],
    ['dApp file:// frame', page('file://')],
    ['Prime purchase modal', markWebEmbedChannelPayload(page('null'), false)],
  ])('rejects %s', async (_label, request) => {
    const provider = setup();
    await expect(provider.fetchStream(request, streamOpen)).rejects.toThrow(
      'fetchStream: not allowed',
    );
    await expect(provider.getSensitiveEncodeKey(request)).rejects.toThrow(
      'getSensitiveEncodeKey: not allowed',
    );
    await expect(provider.webEmbedApiReady(request)).rejects.toThrow(
      'webEmbedApiReady: not allowed',
    );
    await expect(provider.webEmbedApiNotReady(request)).rejects.toThrow(
      'webEmbedApiNotReady: not allowed',
    );
    expect(streamRelay).not.toHaveBeenCalled();
  });

  it('serves the singleton web-embed page', async () => {
    const provider = setup();
    const request = markWebEmbedChannelPayload(page('null'), true);
    await expect(provider.fetchStream(request, streamOpen)).resolves.toEqual({
      ok: true,
      cancelled: true,
    });
    await expect(provider.getSensitiveEncodeKey(request)).resolves.toBe(
      'encode-key',
    );
    provider.activateWebEmbedMount({ mountId: 'singleton', mountSequence: 1 });
    await provider.webEmbedApiReady(request, { mountId: 'singleton' });
    expect(provider.isWebEmbedApiReady).toBe(true);
    await provider.webEmbedApiNotReady(request, { mountId: 'singleton' });
    expect(provider.isWebEmbedApiReady).toBe(false);
  });

  it('lets the host reset readiness without a page request', async () => {
    const provider = setup();
    provider.isWebEmbedApiReady = true;
    await provider.setWebEmbedApiNotReady();
    expect(provider.isWebEmbedApiReady).toBe(false);
  });

  it('keeps the encode key from other privileged pages off native', async () => {
    const env = platformEnv as { isNative?: boolean };
    env.isNative = false;
    try {
      await expect(
        setup().getSensitiveEncodeKey(page('https://tradingview.onekey.so')),
      ).rejects.toThrow('getSensitiveEncodeKey: not allowed');
    } finally {
      env.isNative = true;
    }
  });
});

describe('ProviderApiPrivate risk white list', () => {
  const request = {
    origin: 'https://site.example',
    scope: '$private',
    data: { method: 'wallet_addBrowserUrlToRiskWhiteList' },
  } as unknown as IJsBridgeMessagePayload;

  function setupWithModalResult(result: unknown) {
    const addBrowserUrlToRiskWhiteList = jest.fn(async () => undefined);
    const provider = new ProviderApiPrivate({
      backgroundApi: {
        serviceDApp: { openRiskWhiteListModal: jest.fn(async () => result) },
        serviceDiscovery: { addBrowserUrlToRiskWhiteList },
      },
    });
    return { provider, addBrowserUrlToRiskWhiteList };
  }

  it('adds the site after the user confirms', async () => {
    const { provider, addBrowserUrlToRiskWhiteList } = setupWithModalResult({
      confirmed: true,
    });
    await provider.wallet_addBrowserUrlToRiskWhiteList(request);
    expect(addBrowserUrlToRiskWhiteList).toHaveBeenCalledWith(
      'https://site.example',
    );
  });

  it.each([[undefined], [{}], [{ confirmed: 'true' }]])(
    'leaves the list alone when the modal settles with %j',
    async (result) => {
      const { provider, addBrowserUrlToRiskWhiteList } =
        setupWithModalResult(result);
      await expect(
        provider.wallet_addBrowserUrlToRiskWhiteList(request),
      ).rejects.toMatchObject({ code: 4001 });
      expect(addBrowserUrlToRiskWhiteList).not.toHaveBeenCalled();
    },
  );
});
