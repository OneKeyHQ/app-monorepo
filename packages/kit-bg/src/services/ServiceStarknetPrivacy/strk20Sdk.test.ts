/*
yarn jest packages/kit-bg/src/services/ServiceStarknetPrivacy/strk20Sdk.test.ts

The vendored SDK is mocked virtually, so this runs before its dependencies are
installed. What is pinned here is the wiring: discovery must be constructed with
the OHTTP option, because every discovery request carries the viewing key.
*/
const createPrivateTransfers = jest.fn((params: unknown) => params);
const indexerConstructorCalls: unknown[][] = [];

class FakeIndexerDiscoveryProvider {
  async discoverNotes() {
    return { cursor: {} };
  }
  async discoverChannels() {
    return { channels: [], total: 0 };
  }
  async fetchHistory() {
    return {
      transactions: [],
      cursor: { subchannels: [], historyComplete: true },
    };
  }
  constructor(...args: unknown[]) {
    indexerConstructorCalls.push(args);
  }
}

const transportConstructorCalls: unknown[][] = [];
const proofProviderConstructorCalls: unknown[][] = [];

function makeRecordingClass(calls: unknown[][]) {
  return jest.fn(function recorder(this: unknown, ...args: unknown[]) {
    calls.push(args);
  });
}

const FakeStarkscanProvingService = makeRecordingClass(
  transportConstructorCalls,
);
const FakeProvingServiceProofProvider = makeRecordingClass(
  proofProviderConstructorCalls,
);

jest.mock(
  '../../vaults/impls/starknet/sdkStarknet/privacy',
  () => ({
    __esModule: true,
    createPrivateTransfers,
    classifyTransaction: jest.requireActual<
      typeof import('../../vaults/impls/starknet/sdkStarknet/privacy/internal/action-classifier')
    >(
      '../../vaults/impls/starknet/sdkStarknet/privacy/internal/action-classifier',
    ).classifyTransaction,
    IndexerDiscoveryProvider: FakeIndexerDiscoveryProvider,
    StarkscanProvingService: FakeStarkscanProvingService,
    ProvingServiceProofProvider: FakeProvingServiceProofProvider,
  }),
  { virtual: true },
);

// eslint-disable-next-line import/first
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import/first
import type { IProxyRequest } from '@onekeyhq/shared/types/proxy';

// eslint-disable-next-line import/first
import {
  buildOhttpOption,
  createStrk20ProverProxyFetch,
  createStrk20Transfers,
  deserializeHistoryCursor,
  fetchStrk20HistoryPage,
  getStrk20HistoryTransfers,
  resolvePrivateHistoryKind,
  serializeHistoryCursor,
} from './strk20Sdk';

// eslint-disable-next-line import/first
import type { IStrk20ProverProxyItem } from './strk20Sdk';

const POOL =
  '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';
const PINNED = new Uint8Array([0xaa, 0xbb]);

beforeEach(() => {
  jest.clearAllMocks();
  indexerConstructorCalls.length = 0;
  transportConstructorCalls.length = 0;
  proofProviderConstructorCalls.length = 0;
});

describe('createStrk20Transfers', () => {
  const run = () =>
    createStrk20Transfers({
      accountAddress: '0x1',
      signer: {} as never,
      viewingKey: '0x2',
      poolAddress: POOL,
      chainId: '0x534e5f4d41494e',
      discoveryUrl: 'https://discovery.example',
      provingUrl: 'https://prover.example',
      ohttp: { publicKeyConfig: PINNED },
    });

  it('constructs the discovery provider itself so OHTTP can be enabled', async () => {
    await run();

    // A `{ url }` config would go through the factory, which builds the provider
    // with no options at all — structurally unable to carry OHTTP.
    expect(indexerConstructorCalls).toHaveLength(1);
    expect(indexerConstructorCalls[0]).toEqual([
      'https://discovery.example',
      POOL,
      { ohttp: { publicKeyConfig: PINNED } },
    ]);
  });

  it('hands the factory a provider instance, not a url config', async () => {
    await run();

    const [params] = createPrivateTransfers.mock.calls[0] as [
      { discoveryProvider: unknown; provingProvider: { ohttp?: unknown } },
    ];
    expect(params.discoveryProvider).toBeInstanceOf(
      FakeIndexerDiscoveryProvider,
    );
    expect(params.provingProvider.ohttp).toEqual({
      publicKeyConfig: PINNED,
    });
  });
});

describe('createStrk20Transfers with starkscan proving', () => {
  const proverFetch = jest.fn() as unknown as typeof fetch;
  const getProofNonce = jest.fn(async () => 7n);
  const runStarkscan = (fetchImpl?: typeof fetch) =>
    createStrk20Transfers({
      accountAddress: '0x1',
      signer: {} as never,
      viewingKey: '0x2',
      poolAddress: POOL,
      chainId: '0x534e5f4d41494e',
      discoveryUrl: 'https://discovery.example',
      provingUrl: '',
      provingKind: 'starkscan',
      proverFetch: fetchImpl,
      getProofNonce,
      ohttp: { publicKeyConfig: PINNED },
    });

  it('tunnels the transport through the proxy fetch, no url config', async () => {
    await runStarkscan(proverFetch);

    expect(transportConstructorCalls).toEqual([
      [{ baseUrl: '', fetchImpl: proverFetch }],
    ]);
    expect(proofProviderConstructorCalls).toHaveLength(1);
    expect(proofProviderConstructorCalls[0]).toEqual([
      '',
      '0x534e5f4d41494e',
      {
        transport: expect.any(FakeStarkscanProvingService),
        getNonce: getProofNonce,
      },
    ]);
    const [params] = createPrivateTransfers.mock.calls[0] as [
      { provingProvider: unknown },
    ];
    expect(params.provingProvider).toBeInstanceOf(
      FakeProvingServiceProofProvider,
    );
    expect(params.provingProvider).not.toHaveProperty('url');
  });

  it('throws without the proxy fetch', async () => {
    await expect(runStarkscan()).rejects.toThrow(/wallet proxy/);
    expect(createPrivateTransfers).not.toHaveBeenCalled();
  });

  it('leaves the jsonRpc path on the url config', async () => {
    await createStrk20Transfers({
      accountAddress: '0x1',
      signer: {} as never,
      viewingKey: '0x2',
      poolAddress: POOL,
      chainId: '0x1',
      discoveryUrl: 'https://discovery.example',
      provingUrl: 'https://prover.example',
      provingKind: 'jsonRpc',
      ohttp: { publicKeyConfig: PINNED },
    });
    const [params] = createPrivateTransfers.mock.calls[0] as [
      { provingProvider: { url: string } },
    ];
    expect(params.provingProvider.url).toBe('https://prover.example');
    expect(transportConstructorCalls).toHaveLength(0);
  });
});

describe('direct OHTTP history discovery', () => {
  it('uses the pinned key without requiring a backend relay', async () => {
    await fetchStrk20HistoryPage({
      discoveryUrl: 'https://discovery.example',
      poolAddress: POOL,
      accountAddress: '0x1',
      viewingKey: '0x2',
      ohttp: { publicKeyConfig: PINNED },
    });
    expect(indexerConstructorCalls[0]).toEqual([
      'https://discovery.example',
      POOL,
      { ohttp: { publicKeyConfig: PINNED } },
    ]);
  });
});

describe('buildOhttpOption', () => {
  it('is undefined when OHTTP is absent or switched off', () => {
    expect(buildOhttpOption(undefined)).toBeUndefined();
    expect(buildOhttpOption({ enabled: false })).toBeUndefined();
    expect(
      buildOhttpOption({ enabled: false, publicKeyConfig: '0xaabb' }),
    ).toBeUndefined();
  });

  it('decodes the pinned key config with or without a 0x prefix', () => {
    expect(
      buildOhttpOption({ enabled: true, publicKeyConfig: '0xaabb' }),
    ).toEqual({ relayUrl: undefined, publicKeyConfig: PINNED });
    expect(
      buildOhttpOption({ enabled: true, publicKeyConfig: 'aabb' }),
    ).toEqual({ relayUrl: undefined, publicKeyConfig: PINNED });
  });

  it('passes the relay through', () => {
    const option = buildOhttpOption({
      enabled: true,
      relayUrl: 'https://relay.example',
      publicKeyConfig: '0xaabb',
    });
    // the SDK option is `boolean | { ... }`; we only ever build the object form
    expect(typeof option).toBe('object');
    expect(option).toMatchObject({ relayUrl: 'https://relay.example' });
  });
});

describe('history cursor round trip', () => {
  it('survives bg to main and back with no bigint on the wire', () => {
    const cursor = {
      subchannels: [
        {
          channelKey: BigInt('0x1a'),
          token: BigInt('0x2b'),
          channelKind: 'incoming' as const,
          counterparty: BigInt('0x3c'),
          nextIndex: 4,
        },
      ],
      beginBlockNumber: 900,
      historyComplete: false,
    };

    const wire = serializeHistoryCursor(cursor);
    expect(JSON.stringify(wire)).toContain('0x1a');
    expect(deserializeHistoryCursor(wire)).toEqual(cursor);
  });

  it('rejects an unknown channel kind rather than trusting it', () => {
    expect(() =>
      deserializeHistoryCursor({
        subchannels: [
          {
            channelKey: '0x1',
            token: '0x2',
            channelKind: 'sideways' as never,
            counterparty: '0x3',
          },
        ],
        historyComplete: false,
      }),
    ).toThrow(/channel kind/i);
  });
});

describe('resolvePrivateHistoryKind', () => {
  const empty = {
    deposits: [],
    withdrawals: [],
    openNoteDeposits: [],
  };

  it.each([
    ['register', { ...empty, registration: {} }],
    ['withdraw', { ...empty, withdrawals: [{}] }],
    ['deposit', { ...empty, deposits: [{}] }],
    ['deposit', { ...empty, openNoteDeposits: [{}] }],
    ['transfer', empty],
  ])('resolves %s', (expected, transaction) => {
    expect(resolvePrivateHistoryKind(transaction)).toBe(expected);
  });

  it('keeps a withdrawal a withdrawal even when notes travel with it', () => {
    // user_addr is encrypted, so an unrelated withdrawal can share our tx; it
    // must not be relabelled a transfer.
    expect(
      resolvePrivateHistoryKind({
        ...empty,
        withdrawals: [{}],
        deposits: [{}],
      }),
    ).toBe('withdraw');
  });
});

describe('createStrk20ProverProxyFetch', () => {
  const setup = (item: IStrk20ProverProxyItem | undefined) => {
    const post = jest.fn(
      async (_request: IProxyRequest, _signal?: AbortSignal) => item,
    );
    const proxyFetch = createStrk20ProverProxyFetch({
      networkId: 'starknet--mainnet',
      post,
    });
    return { post, proxyFetch };
  };

  it('wraps a submit in a prover-route item with the idempotency key', async () => {
    const { post, proxyFetch } = setup({
      success: true,
      status: 202,
      data: { jobId: 'job-1' },
    });
    const { signal } = new AbortController();
    const payload = {
      block_id: 'latest',
      transaction: { sender_address: POOL },
    };

    await proxyFetch('/prove', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'idem-1',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    expect(post).toHaveBeenCalledWith(
      {
        networkId: 'starknet--mainnet',
        body: [
          {
            route: 'prover',
            params: {
              method: 'POST',
              url: '/prove',
              params: [],
              data: payload,
              headers: { 'Idempotency-Key': 'idem-1' },
            },
          },
        ],
      },
      signal,
    );
  });

  it('sends a poll with neither body nor headers', async () => {
    const { post, proxyFetch } = setup({ success: true, status: 200 });

    await proxyFetch('/prove/job-1', {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    expect(post.mock.calls[0][0].body[0].params).toEqual({
      method: 'GET',
      url: '/prove/job-1',
      params: [],
    });
  });

  it('rebuilds the upstream status, body and Retry-After', async () => {
    const { proxyFetch } = setup({
      success: false,
      status: 429,
      retryAfter: '30',
      data: { code: 'rate_limited', message: 'slow down' },
    });

    const res = await proxyFetch('/prove', { method: 'POST', body: '{}' });

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    await expect(res.json()).resolves.toEqual({
      code: 'rate_limited',
      message: 'slow down',
    });
  });

  it('falls back to 200 or a gateway error without an upstream status', async () => {
    const ok = await setup({ success: true, data: { jobId: 'j' } }).proxyFetch(
      '/prove/j',
      { method: 'GET' },
    );
    expect(ok.status).toBe(200);

    const failed = await setup({
      success: false,
      error: 'upstream down',
    }).proxyFetch('/prove/j', { method: 'GET' });
    expect(failed.status).toBe(502);
    await expect(failed.json()).resolves.toEqual({ message: 'upstream down' });
  });

  it('rejects like fetch with a TypeError when no response arrives', async () => {
    await expect(
      setup(undefined).proxyFetch('/prove/j', { method: 'GET' }),
    ).rejects.toThrow(TypeError);

    const post = jest.fn(async () => {
      throw new OneKeyLocalError('socket hang up');
    });
    const proxyFetch = createStrk20ProverProxyFetch({
      networkId: 'starknet--mainnet',
      post,
    });
    await expect(proxyFetch('/prove/j', { method: 'GET' })).rejects.toEqual(
      new TypeError('socket hang up'),
    );
  });
});

describe('private history attribution', () => {
  it('includes only known note counterparties and owned public movements', async () => {
    const account = 10n;
    const pool = 20n;
    const movements = await getStrk20HistoryTransfers(
      {
        blockNumber: 100,
        transactionHash: 1n,
        deposits: [
          { fromAddress: account, token: 1n, amount: 5n },
          { fromAddress: 999n, token: 1n, amount: 99n },
        ],
        withdrawals: [
          { toAddress: account, token: 1n, amount: 4n },
          { toAddress: 999n, token: 1n, amount: 88n },
        ],
        openNoteDeposits: [],
        notes: [
          {
            channelKind: 'incoming',
            token: 1n,
            counterparty: 30n,
            amount: 3n,
            noteId: 1n,
            noteIndex: 0,
            salt: 0n,
          },
          {
            channelKind: 'outgoing',
            token: 1n,
            counterparty: 40n,
            amount: 2n,
            noteId: 2n,
            noteIndex: 1,
            salt: 0n,
          },
        ],
      },
      account,
      pool,
    );
    expect(
      movements.map(({ kind, from, to, token, amount }) => ({
        kind,
        from,
        to,
        token,
        amount,
      })),
    ).toEqual([
      { kind: 'deposit', from: account, to: pool, token: 1n, amount: 5n },
      { kind: 'withdraw', from: pool, to: account, token: 1n, amount: 4n },
      { kind: 'transfer', from: 30n, to: account, token: 1n, amount: 3n },
      { kind: 'transfer', from: account, to: 40n, token: 1n, amount: 2n },
    ]);
  });
  it('does not turn synthetic registration into an asset transfer', async () => {
    expect(
      await getStrk20HistoryTransfers(
        {
          blockNumber: 100,
          transactionHash: 0n,
          registeredPubkey: 1n,
          deposits: [],
          withdrawals: [],
          notes: [],
          openNoteDeposits: [],
        },
        10n,
        20n,
      ),
    ).toEqual([]);
  });
});
