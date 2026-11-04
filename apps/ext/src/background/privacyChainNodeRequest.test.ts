import { PRIVACY_CHAIN_NODE_REQUEST_MESSAGE } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch.ext-pages-v3';
import type { IPrivacyChainNodeRelayResult } from '@onekeyhq/kit-bg/src/utils/privacyChainNodeRelay';
import type { IPrivacyChainRelayTargetSource } from '@onekeyhq/kit-bg/src/utils/privacyChainRelayTargets';

import { installPrivacyChainNodeRequestListener } from './privacyChainNodeRequest';

jest.mock('@onekeyhq/kit-bg/src/vaults/settings', () => ({
  getVaultSettings: jest.fn(),
}));

type IMessage = {
  type?: string;
  url?: string;
  contentType?: string;
  body?: number[];
};
type IListener = (
  message: IMessage,
  sender: { id?: string; tab?: { id: number } },
  sendResponse: (response: IPrivacyChainNodeRelayResult) => void,
) => boolean | undefined;

const addListener = jest.fn<void, [IListener]>();
const globals = globalThis as unknown as {
  chrome?: {
    runtime: { id: string; onMessage: { addListener: typeof addListener } };
  };
};
const savedChrome = globals.chrome;
const savedFetch = globalThis.fetch;
const XMR_NODE = 'https://xmr-node.example:18089';
const targets: IPrivacyChainRelayTargetSource = {
  getLocalWalletNetworkIds: async () => ['xmr--mainnet'],
  getNodeUrls: async () => [XMR_NODE],
};
let listener: IListener;

beforeEach(() => {
  addListener.mockClear();
  globals.chrome = {
    runtime: { id: 'own-extension', onMessage: { addListener } },
  };
  installPrivacyChainNodeRequestListener(targets);
  [listener] = addListener.mock.calls[0];
});

afterEach(() => {
  globals.chrome = savedChrome;
  globalThis.fetch = savedFetch;
});

function send(message: IMessage, sender = { id: 'own-extension' }) {
  return new Promise<IPrivacyChainNodeRelayResult>((resolve) => {
    listener(message, sender, resolve);
  });
}

it('relays a configured XMR node request without credentials or redirects', async () => {
  const fetchImpl = jest.fn(async () => new Response(new Uint8Array([7])));
  globalThis.fetch = fetchImpl;
  await expect(
    send({
      type: PRIVACY_CHAIN_NODE_REQUEST_MESSAGE,
      url: `${XMR_NODE}/json_rpc`,
      body: [1],
    }),
  ).resolves.toEqual({ ok: true, b64: 'Bw==' });
  expect(fetchImpl).toHaveBeenCalledWith(
    `${XMR_NODE}/json_rpc`,
    expect.objectContaining({ credentials: 'omit', redirect: 'error' }),
  );
});

it('refuses a URL that is not a configured node', async () => {
  const fetchImpl = jest.fn();
  globalThis.fetch = fetchImpl;
  await expect(
    send({
      type: PRIVACY_CHAIN_NODE_REQUEST_MESSAGE,
      url: 'http://192.168.1.1/admin',
    }),
  ).resolves.toEqual({
    ok: false,
    error: 'not a configured privacy-chain node',
  });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('refuses a content script', async () => {
  await expect(
    send(
      {
        type: PRIVACY_CHAIN_NODE_REQUEST_MESSAGE,
        url: `${XMR_NODE}/json_rpc`,
      },
      { id: 'own-extension', tab: { id: 1 } } as { id: string },
    ),
  ).resolves.toEqual({ ok: false, error: 'not allowed' });
});
