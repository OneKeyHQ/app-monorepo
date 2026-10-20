import { markWebEmbedChannelPayload } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import {
  createPrivacyChainFetchStreamRelay,
  relayPrivacyChainNodeRequest,
} from '../utils/privacyChainNodeRelay';

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
  relayPrivacyChainNodeRequest: jest.fn(async () => ({ ok: true, b64: '' })),
  createPrivacyChainFetchStreamRelay: jest.fn(() => streamRelay),
}));

const page = (origin: string): IJsBridgeMessagePayload =>
  ({
    origin,
    scope: '$private',
    data: { method: 'fetchStream' },
  }) as IJsBridgeMessagePayload;

const nodeRequest = {
  url: 'http://192.168.1.1/admin',
  contentType: 'application/json',
  b64: '',
};
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
    jest.mocked(relayPrivacyChainNodeRequest).mockClear();
    streamRelay.mockClear();
  });

  it('builds the stream relay against configured nodes', () => {
    setup();
    expect(createPrivacyChainFetchStreamRelay).toHaveBeenCalled();
  });

  it.each([
    // A dApp's data: iframe: opaque origin, no host mark.
    ['dApp data: iframe', page('null')],
    ['dApp file:// frame', page('file://')],
    // The Prime purchase modal is a web-embed page but not the singleton.
    ['Prime purchase modal', markWebEmbedChannelPayload(page('null'), false)],
  ])('rejects %s', async (_label, request) => {
    const provider = setup();
    await expect(
      provider.privacyChainNodeRequest(request, nodeRequest),
    ).rejects.toThrow('privacyChainNodeRequest: not allowed');
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
    expect(relayPrivacyChainNodeRequest).not.toHaveBeenCalled();
    expect(streamRelay).not.toHaveBeenCalled();
  });

  it('serves the singleton web-embed page', async () => {
    const provider = setup();
    const request = markWebEmbedChannelPayload(page('null'), true);
    await expect(
      provider.privacyChainNodeRequest(request, nodeRequest),
    ).resolves.toEqual({ ok: true, b64: '' });
    await expect(provider.fetchStream(request, streamOpen)).resolves.toEqual({
      ok: true,
      cancelled: true,
    });
    await expect(provider.getSensitiveEncodeKey(request)).resolves.toBe(
      'encode-key',
    );
    await provider.webEmbedApiReady(request);
    expect(provider.isWebEmbedApiReady).toBe(true);
    await provider.webEmbedApiNotReady(request);
    expect(provider.isWebEmbedApiReady).toBe(false);
  });

  it('lets the host reset readiness without a page request', async () => {
    const provider = setup();
    provider.isWebEmbedApiReady = true;
    await provider.setWebEmbedApiNotReady();
    expect(provider.isWebEmbedApiReady).toBe(false);
  });
});
