import type { IPrivacyChainRelayTargetSource } from '@onekeyhq/kit-bg/src/utils/privacyChainRelayTargets';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { FETCH_STREAM_MESSAGE } from '@onekeyhq/shared/types/fetchStream';
import type {
  IFetchStreamRequest,
  IFetchStreamResult,
} from '@onekeyhq/shared/types/fetchStream';

import { installFetchStreamListener } from './fetchStream';

jest.mock('@onekeyhq/kit-bg/src/vaults/settings', () => ({
  getVaultSettings: jest.fn(),
}));

const NODE = 'https://zcash-mainnet.chainsafe.dev';
const targets: IPrivacyChainRelayTargetSource = {
  getLocalWalletNetworkIds: async () => ['zcash--mainnet'],
  getNodeUrls: async () => [NODE],
};

type IListener = (
  message: { type?: string; request?: IFetchStreamRequest },
  sender: { id?: string; tab?: { id: number } },
  sendResponse: (response: IFetchStreamResult) => void,
) => boolean | undefined;

const addListener = jest.fn<void, [IListener]>();
const globals = globalThis as unknown as {
  chrome?: {
    runtime: { id: string; onMessage: { addListener: typeof addListener } };
  };
};
const savedChrome = globals.chrome;
const savedFetch = globalThis.fetch;
let listener: IListener;

beforeEach(() => {
  addListener.mockClear();
  globals.chrome = {
    runtime: { id: 'own-extension', onMessage: { addListener } },
  };
  installFetchStreamListener(targets);
  [listener] = addListener.mock.calls[0];
});

afterEach(() => {
  globals.chrome = savedChrome;
  jest.restoreAllMocks();
  globalThis.fetch = savedFetch;
});

const NODE_URL = `${NODE}/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock`;
const message = {
  type: FETCH_STREAM_MESSAGE,
  request: {
    action: 'open',
    url: NODE_URL,
    method: 'POST',
    headers: [],
    b64: '',
  } as IFetchStreamRequest,
};

it.each([{ id: 'other-extension' }, { id: 'own-extension', tab: { id: 1 } }])(
  'rejects an untrusted sender before any network request: %j',
  (sender) => {
    const fetchImpl = jest.spyOn(globalThis, 'fetch');
    const reply = jest.fn();
    expect(listener(message, sender, reply)).toBeUndefined();
    expect(reply).toHaveBeenCalledWith({ ok: false, error: 'not allowed' });
    expect(fetchImpl).not.toHaveBeenCalled();
  },
);

it('leaves unrelated messages to their existing listeners', () => {
  const reply = jest.fn();
  expect(
    listener(
      { type: 'privacyChain/nodeRequest' },
      { id: 'own-extension' },
      reply,
    ),
  ).toBeUndefined();
  expect(reply).not.toHaveBeenCalled();
});

it('rejects a missing stream request', () => {
  const reply = jest.fn();
  expect(
    listener({ type: FETCH_STREAM_MESSAGE }, { id: 'own-extension' }, reply),
  ).toBeUndefined();
  expect(reply).toHaveBeenCalledWith({
    ok: false,
    error: 'missing fetch stream request',
  });
});

it('keeps the reply channel open and releases the trusted host stream on cancel', async () => {
  const fetchImpl = jest.fn(async () => new Response('ok'));
  globalThis.fetch = fetchImpl;
  const sender = { id: 'own-extension' };
  const opened = await new Promise<IFetchStreamResult>((resolve) => {
    expect(listener(message, sender, resolve)).toBe(true);
  });
  if (!opened.ok || !('response' in opened))
    throw new OneKeyLocalError('open failed');
  expect(opened.response.status).toBe(200);
  expect(fetchImpl).toHaveBeenCalledWith(
    NODE_URL,
    expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
    }),
  );
  const cancelled = await new Promise<IFetchStreamResult>((resolve) => {
    expect(
      listener(
        {
          type: FETCH_STREAM_MESSAGE,
          request: { action: 'cancel', id: opened.response.id },
        },
        sender,
        resolve,
      ),
    ).toBe(true);
  });
  expect(cancelled).toEqual({ ok: true, cancelled: true });
});

it.each([
  ['an arbitrary URL', 'https://example.test/download', 'POST'],
  ['a GET to the configured node', NODE_URL, 'GET'],
])(
  'refuses %s from a trusted sender before any network request',
  async (_label, url, method) => {
    const fetchImpl = jest.spyOn(globalThis, 'fetch');
    const result = await new Promise<IFetchStreamResult>((resolve) => {
      expect(
        listener(
          {
            type: FETCH_STREAM_MESSAGE,
            request: { action: 'open', url, method, headers: [] },
          },
          { id: 'own-extension' },
          resolve,
        ),
      ).toBe(true);
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    expect(fetchImpl).not.toHaveBeenCalled();
  },
);
