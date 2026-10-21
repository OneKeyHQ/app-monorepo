/*
yarn jest packages/kit-bg/src/services/ServiceStarknetPrivacy/strk20Sdk.test.ts

The vendored SDK is mocked virtually, so this runs before its dependencies are
installed. What is pinned here is the wiring: discovery must be constructed with
the OHTTP option, because every discovery request carries the viewing key.
*/
const createPrivateTransfers = jest.fn((params: unknown) => params);
const indexerConstructorCalls: unknown[][] = [];

class FakeIndexerDiscoveryProvider {
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
    IndexerDiscoveryProvider: FakeIndexerDiscoveryProvider,
    StarkscanProvingService: FakeStarkscanProvingService,
    ProvingServiceProofProvider: FakeProvingServiceProofProvider,
  }),
  { virtual: true },
);

// eslint-disable-next-line import/first
import {
  buildOhttpOption,
  createStrk20Transfers,
  deserializeHistoryCursor,
  resolvePrivateHistoryKind,
  serializeHistoryCursor,
} from './strk20Sdk';

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
      chainId: '0x534e5f5345504f4c4941',
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
  const runStarkscan = (provingApiKey?: string) =>
    createStrk20Transfers({
      accountAddress: '0x1',
      signer: {} as never,
      viewingKey: '0x2',
      poolAddress: POOL,
      chainId: '0x534e5f4d41494e',
      discoveryUrl: 'https://discovery.example',
      provingUrl: 'https://api.starkscan.co/v1/SN_MAIN',
      provingKind: 'starkscan',
      provingApiKey,
      nodeUrl: 'https://rpc.example',
      ohttp: { publicKeyConfig: PINNED },
    });

  it('builds the transport and a provider instance, no url config', async () => {
    await runStarkscan('key-1');

    expect(transportConstructorCalls).toEqual([
      [{ baseUrl: 'https://api.starkscan.co/v1/SN_MAIN', apiKey: 'key-1' }],
    ]);
    expect(proofProviderConstructorCalls).toHaveLength(1);
    expect(proofProviderConstructorCalls[0]).toEqual([
      '',
      '0x534e5f4d41494e',
      {
        transport: expect.any(FakeStarkscanProvingService),
        nodeUrl: 'https://rpc.example',
        poolAddress: POOL,
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

  it('throws when the key is missing', async () => {
    await expect(runStarkscan()).rejects.toThrow(/API key/);
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
    });
    const [params] = createPrivateTransfers.mock.calls[0] as [
      { provingProvider: { url: string } },
    ];
    expect(params.provingProvider.url).toBe('https://prover.example');
    expect(transportConstructorCalls).toHaveLength(0);
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
