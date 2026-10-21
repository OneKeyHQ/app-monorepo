/*
yarn jest packages/kit-bg/src/services/ServiceStarknetPrivacy/index.builds.test.ts

Covers the build-path guards and the multicall assembly. `./strk20Sdk` is mocked
so these run without the vendored SDK installed; what is under test is this
service's own logic, not the SDK's.
*/
const starknetPrivacy = {
  getRecord: jest.fn(),
  upsertRecord: jest.fn(),
  patchRecord: jest.fn(),
  setOptInStatus: jest.fn(),
  findAccountRecord: jest.fn(),
};
const starknetPrivacyConfig = {
  getEnvelope: jest.fn(),
  saveEnvelope: jest.fn(),
};

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    get starknetPrivacy() {
      return starknetPrivacy;
    },
    get starknetPrivacyConfig() {
      return starknetPrivacyConfig;
    },
  },
}));

const getVault = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('../../vaults/factory', () => ({
  __esModule: true,
  vaultFactory: {
    getVault: (...args: unknown[]) => getVault(...args),
    getChainOnlyVault: (...args: unknown[]) => getVault(...args),
  },
}));

const discoverNotes = jest.fn();
const discoverRequirement = jest.fn();
const createProofInvocation = jest.fn();
const executeWithInvocation = jest.fn();
const withToken = jest.fn();
const deposit = jest.fn();
const withdraw = jest.fn();
const transfer = jest.fn();

jest.mock('./strk20Sdk', () => ({
  __esModule: true,
  buildOhttpOption: () => undefined,
  createStrk20Signer: () => ({}),
  createStrk20Transfers: jest.fn(async () => ({
    discoverNotes,
    discoverRequirement,
    executeWithInvocation,
    build: () => ({
      register: () => ({ createProofInvocation }),
      with: (...args: unknown[]) => {
        withToken(...args);
        return { deposit, withdraw, transfer, createProofInvocation };
      },
    }),
  })),
  fetchStrk20HistoryPage: jest.fn(),
  resolvePrivateHistoryKind: () => 'transfer',
  serializeHistoryCursor: (cursor: unknown) => cursor,
}));

// eslint-disable-next-line import/first, import-path/forbidden
import ServiceStarknetPrivacy from './index';

const NETWORK_ID = 'starknet--sepolia';
const ACCOUNT_ID = "hd-1--m/44'/9004'/0'/0/0";
const SEPOLIA_POOL =
  '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';
const ACCOUNT_ADDRESS =
  '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec';
const STRK =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const ETH =
  '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
const VIEWING_KEY =
  '0x0195e031668fd442f9057e4f5b22c9297e98046dfc06b2efb9083f2fd79239af';
const PUBLIC_KEY_X =
  '0x0775de99ba0b481868ff5513344a5f97729558afb6783033ec8fea502ec19d15';
// two STRK, what the live Sepolia pool reports for get_fee_amount
const PROTOCOL_FEE = '2000000000000000000';

const enabledConfig = {
  networkId: NETWORK_ID,
  enabled: true,
  poolAddress: SEPOLIA_POOL,
  discoveryUrl: 'https://discovery.example',
  provingUrl: 'https://prover.example',
  ohttp: { enabled: true, publicKeyConfig: '0xaabb' },
  auditorPublicKey: '0x01d17f',
  minRpcSpecVersion: '0.10.1',
};

function build(options?: {
  isPoolPaused?: boolean;
  registeredPublicKey?: string;
  lastTxBlockNumber?: number;
}) {
  const client = {
    getSpecVersion: jest.fn(async () => '0.10.2'),
    isAccountDeployed: jest.fn(async () => true),
    getBlockNumber: jest.fn(async () => 1000),
    isPoolPaused: jest.fn(async () => options?.isPoolPaused ?? false),
    getPoolFeeAmount: jest.fn(async () => PROTOCOL_FEE),
    getPoolRegisteredPublicKey: jest.fn(
      async () => options?.registeredPublicKey,
    ),
    rpcUrl: 'https://rpc.example/rpc/v0_10',
  };
  const deriveStrk20ViewingKey = jest.fn(async () => ({
    viewingKey: VIEWING_KEY,
    publicKeyX: PUBLIC_KEY_X,
    counter: 0,
  }));
  const buildPrivacyEncodedTx = jest.fn(async (p: unknown) => p);
  const vault = {
    getClient: async () => client,
    getAccountAddress: async () => ACCOUNT_ADDRESS,
    getAccount: async () => ({ address: ACCOUNT_ADDRESS, path: 'm/1' }),
    getNetwork: async () => ({
      chainId: '0x534e5f5345504f4c4941',
      feeMeta: { decimals: 18 },
    }),
    keyring: { deriveStrk20ViewingKey },
    buildPrivacyEncodedTx,
    buildUnsignedTx: jest.fn(async (p: { encodedTx: unknown }) => ({
      encodedTx: p.encodedTx,
    })),
  };
  getVault.mockResolvedValue(vault);

  const promptPasswordVerifyByAccount = jest.fn(async () => ({
    password: 'pw',
  }));
  const backgroundApi = {
    serviceNetwork: {
      getVaultSettings: jest.fn(async () => ({
        privacyPool: {
          activation: 'account-opt-in',
          balanceShape: 'pooled',
          poolsPerToken: true,
          requiresRegistration: true,
          sequencingCooldownBlocks: 10,
        },
      })),
    },
    servicePassword: { promptPasswordVerifyByAccount },
  };
  const service = new ServiceStarknetPrivacy({ backgroundApi });
  starknetPrivacy.getRecord.mockResolvedValue(
    options?.lastTxBlockNumber === undefined
      ? undefined
      : {
          networkId: NETWORK_ID,
          accountId: ACCOUNT_ID,
          lastTxBlockNumber: options.lastTxBlockNumber,
          optInStatus: 'registered',
        },
  );
  return {
    service,
    client,
    vault,
    buildPrivacyEncodedTx,
    promptPasswordVerifyByAccount,
  };
}

const key = { networkId: NETWORK_ID, accountId: ACCOUNT_ID };
const previousBackgroundScope = globalThis.$onekeyIsInBackground;

beforeAll(() => {
  globalThis.$onekeyIsInBackground = true;
});

afterAll(() => {
  globalThis.$onekeyIsInBackground = previousBackgroundScope;
});

beforeEach(() => {
  jest.clearAllMocks();
  starknetPrivacyConfig.getEnvelope.mockResolvedValue({
    envelope: {
      version: 1,
      updatedAt: 1,
      configs: { [NETWORK_ID]: enabledConfig },
    },
    syncedAt: Date.now(),
  });
  starknetPrivacy.getRecord.mockResolvedValue(undefined);
  createProofInvocation.mockResolvedValue({ invocation: {}, registry: {} });
  executeWithInvocation.mockResolvedValue({
    callAndProof: {
      call: {
        contractAddress: SEPOLIA_POOL,
        entrypoint: 'apply_actions',
        calldata: ['0x1', '0x2'],
      },
      proof: { data: '0xproof', proofFacts: ['0xaa'] },
    },
    warnings: [],
  });
});

function callsOf(buildPrivacyEncodedTx: jest.Mock) {
  const [args] = buildPrivacyEncodedTx.mock.calls.at(-1) as [
    {
      calls: {
        contractAddress: string;
        entrypoint: string;
        calldata: string[];
      }[];
    },
  ];
  return args.calls;
}

describe('build gates', () => {
  it.each([
    ['buildRegisterTx', (s: ServiceStarknetPrivacy) => s.buildRegisterTx(key)],
    [
      'buildPrivateTransferTx',
      (s: ServiceStarknetPrivacy) =>
        s.buildPrivateTransferTx({
          ...key,
          kind: 'deposit',
          tokenAddress: STRK,
          amount: '1',
        }),
    ],
  ])('%s refuses to build while the pool is paused', async (_name, run) => {
    const { service } = build({ isPoolPaused: true });
    await expect(run(service)).rejects.toThrow(/paused/i);
    expect(createProofInvocation).not.toHaveBeenCalled();
  });

  it.each([
    ['buildRegisterTx', (s: ServiceStarknetPrivacy) => s.buildRegisterTx(key)],
    [
      'buildPrivateTransferTx',
      (s: ServiceStarknetPrivacy) =>
        s.buildPrivateTransferTx({
          ...key,
          kind: 'deposit',
          tokenAddress: STRK,
          amount: '1',
        }),
    ],
  ])('%s refuses to build while sequencing is waiting', async (_name, run) => {
    // latest 1000, last tx 996: four of the ten cooldown blocks have passed
    const { service } = build({ lastTxBlockNumber: 996 });
    await expect(run(service)).rejects.toThrow();
    expect(createProofInvocation).not.toHaveBeenCalled();
  });
});

describe('buildRegisterTx mismatch rule', () => {
  it('records mismatch and refuses when the pool holds a different key', async () => {
    const { service } = build({ registeredPublicKey: '0x'.padEnd(66, 'f') });

    await expect(service.buildRegisterTx(key)).rejects.toThrow();
    expect(starknetPrivacy.patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ optInStatus: 'mismatch' }),
      }),
    );
    // the whole point: never write a second registration
    expect(createProofInvocation).not.toHaveBeenCalled();
  });

  it('treats an unset pool key as not registered and proceeds', async () => {
    // the client maps a zero read to undefined, so zero never looks authoritative
    const { service } = build({ registeredPublicKey: undefined });

    await service.buildRegisterTx(key);
    expect(createProofInvocation).toHaveBeenCalledTimes(1);
    expect(starknetPrivacy.patchRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ optInStatus: 'mismatch' }),
      }),
    );
  });

  it('proceeds when the pool key already matches this device', async () => {
    const { service } = build({ registeredPublicKey: PUBLIC_KEY_X });

    await service.buildRegisterTx(key);
    expect(createProofInvocation).toHaveBeenCalledTimes(1);
  });
});

describe('protocol fee', () => {
  it('carries the fee read at build time into the privacy intent', async () => {
    const { service, buildPrivacyEncodedTx } = build();

    await service.buildPrivateTransferTx({
      ...key,
      kind: 'withdraw',
      tokenAddress: ETH,
      amount: '9',
    });

    const [args] = buildPrivacyEncodedTx.mock.calls.at(-1) as [
      { privacy: { protocolFee?: string } },
    ];
    expect(args.privacy.protocolFee).toBe(PROTOCOL_FEE);
  });

  it('reports the live fee in STRK', async () => {
    const { service, client } = build();
    client.getPoolFeeAmount.mockResolvedValue('2500000000000000000');

    await expect(
      service.getProtocolFee({ networkId: NETWORK_ID }),
    ).resolves.toBe('2.5');
  });
});

describe('multicall assembly', () => {
  it('sums fee and amount into one approve when depositing STRK', async () => {
    const { service, buildPrivacyEncodedTx } = build();

    await service.buildPrivateTransferTx({
      ...key,
      kind: 'deposit',
      tokenAddress: STRK,
      amount: '5',
    });

    const calls = callsOf(buildPrivacyEncodedTx);
    expect(calls).toHaveLength(2);
    expect(calls[0].entrypoint).toBe('approve');
    expect(calls[1].entrypoint).toBe('apply_actions');
    // approve overwrites rather than adds, so the one allowance must cover both
    const [, low] = calls[0].calldata;
    expect(BigInt(low)).toBe(BigInt(PROTOCOL_FEE) + BigInt(5));
  });

  it('issues a second approve for a non-STRK deposit, fee first', async () => {
    const { service, buildPrivacyEncodedTx } = build();

    await service.buildPrivateTransferTx({
      ...key,
      kind: 'deposit',
      tokenAddress: ETH,
      amount: '7',
    });

    const calls = callsOf(buildPrivacyEncodedTx);
    expect(calls.map((call) => call.entrypoint)).toEqual([
      'approve',
      'approve',
      'apply_actions',
    ]);
    expect(BigInt(calls[0].calldata[1])).toBe(BigInt(PROTOCOL_FEE));
    expect(BigInt(calls[1].calldata[1])).toBe(BigInt(7));
  });

  it('approves only the fee on a withdraw', async () => {
    const { service, buildPrivacyEncodedTx } = build();

    await service.buildPrivateTransferTx({
      ...key,
      kind: 'withdraw',
      tokenAddress: ETH,
      amount: '9',
    });

    const calls = callsOf(buildPrivacyEncodedTx);
    expect(calls.map((call) => call.entrypoint)).toEqual([
      'approve',
      'apply_actions',
    ]);
    expect(BigInt(calls[0].calldata[1])).toBe(BigInt(PROTOCOL_FEE));
  });

  it('omits the approve entirely when the pool charges nothing', async () => {
    const { service, client, buildPrivacyEncodedTx } = build();
    client.getPoolFeeAmount.mockResolvedValue('0');

    await service.buildPrivateTransferTx({
      ...key,
      kind: 'transfer',
      tokenAddress: ETH,
      amount: '3',
      recipient: ACCOUNT_ADDRESS,
    });

    expect(callsOf(buildPrivacyEncodedTx).map((c) => c.entrypoint)).toEqual([
      'apply_actions',
    ]);
  });

  it.each(['1.5', '-1', 'abc', ''])(
    'rejects the non-integer amount %p before any proving',
    async (amount) => {
      const { service } = build();
      await expect(
        service.buildPrivateTransferTx({
          ...key,
          kind: 'deposit',
          tokenAddress: STRK,
          amount,
        }),
      ).rejects.toThrow();
      expect(createProofInvocation).not.toHaveBeenCalled();
    },
  );

  // Exponent form is a legitimate integer, so it is normalized rather than
  // rejected. What matters is that the approve and the SDK see the same value:
  // rounding twice is what could leave the allowance one unit short.
  it('normalizes an exponent amount identically on both consumers', async () => {
    const { service, buildPrivacyEncodedTx } = build();

    await service.buildPrivateTransferTx({
      ...key,
      kind: 'deposit',
      tokenAddress: ETH,
      amount: '1e3',
    });

    const calls = callsOf(buildPrivacyEncodedTx);
    expect(BigInt(calls[1].calldata[1])).toBe(BigInt(1000));
    expect(deposit).toHaveBeenCalledWith({ amount: BigInt(1000) });
  });
});

describe('read paths never prompt', () => {
  it.each([
    [
      'refreshPrivateBalances',
      (s: ServiceStarknetPrivacy) => s.refreshPrivateBalances(key),
    ],
    [
      'getRecipientRequirement',
      (s: ServiceStarknetPrivacy) =>
        s.getRecipientRequirement({
          ...key,
          recipient: ACCOUNT_ADDRESS,
          tokenAddress: STRK,
        }),
    ],
  ])('%s throws locked on an empty cache', async (_name, run) => {
    const { service, promptPasswordVerifyByAccount } = build();

    await expect(run(service)).rejects.toThrow();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(discoverNotes).not.toHaveBeenCalled();
    expect(discoverRequirement).not.toHaveBeenCalled();
  });

  it('reads once the key is cached by a write path', async () => {
    const { service, promptPasswordVerifyByAccount } = build();
    await service.buildRegisterTx(key);
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);

    discoverNotes.mockResolvedValue({
      notes: new Map([
        [BigInt(STRK), [{ amount: BigInt(4) }, { amount: BigInt(6) }]],
      ]),
    });
    const balances = await service.refreshPrivateBalances(key);

    expect(balances.noteCount).toBe(2);
    expect(balances.byToken[STRK]).toBe('10');
    expect(balances.blockNumber).toBe(1000);
    // one prompt covered both derivation and signing; the read added none
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
  });
});
