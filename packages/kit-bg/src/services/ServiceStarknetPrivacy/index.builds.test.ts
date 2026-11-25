/*
yarn jest packages/kit-bg/src/services/ServiceStarknetPrivacy/index.builds.test.ts

Covers the build-path guards and the multicall assembly. `strk20Adapter` is mocked
so these run without the vendored SDK installed; what is under test is this
service's own logic, not the SDK's.
*/
const starknetPrivacy = {
  getRegisteredAccounts: jest.fn(),
  getRecord: jest.fn(),
  recordConsent: jest.fn(),
  patchRecord: jest.fn(),
  setOptInStatus: jest.fn(),
};

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    get starknetPrivacy() {
      return starknetPrivacy;
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
const createProofInvocation = jest.fn();
const executeWithInvocation = jest.fn();
const withToken = jest.fn();
const deposit = jest.fn();
const withdraw = jest.fn();
const transfer = jest.fn();

jest.mock('../../vaults/impls/starknet/strk20Adapter', () => ({
  __esModule: true,
  buildOhttpOption: () => undefined,
  createStrk20ProverProxyFetch: jest.fn(() => jest.fn()),
  createStrk20Signer: jest.fn(() => ({})),
  createStrk20Transfers: jest.fn(async () => ({
    discoverNotes,
    executeWithInvocation,
    build: () => ({
      register: () => ({ createProofInvocation }),
      with: (...args: unknown[]) => {
        withToken(...args);
        const tokenOps = {
          deposit,
          withdraw,
          transfer,
          createProofInvocation,
          surplusTo: () => tokenOps,
        };
        return tokenOps;
      },
    }),
  })),
  fetchStrk20HistoryPage: jest.fn(),
  getStrk20HistoryTransfers: jest.fn(async () => []),
}));

// eslint-disable-next-line import/first, import-path/forbidden
import ServiceStarknetPrivacy from './index';

// eslint-disable-next-line import/first
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
// eslint-disable-next-line import/first
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';
// eslint-disable-next-line import/first
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
// eslint-disable-next-line import/first
import type { IProxyRequest } from '@onekeyhq/shared/types/proxy';
// eslint-disable-next-line import/first
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
// eslint-disable-next-line import/first
import {
  EStrk20ErrorCode,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';
// eslint-disable-next-line import/first
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

// eslint-disable-next-line import/first
import {
  createStrk20ProverProxyFetch,
  createStrk20Signer,
  createStrk20Transfers,
  fetchStrk20HistoryPage,
  getStrk20HistoryTransfers,
} from '../../vaults/impls/starknet/strk20Adapter';

const NETWORK_ID = 'starknet--mainnet';
const ACCOUNT_ID = "hd-1--m/44'/9004'/0'/0/0";
const MAINNET_POOL =
  '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
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
// two STRK; the live value comes from the pool's get_fee_amount
const PROTOCOL_FEE = '2000000000000000000';

function build(options?: {
  isPoolPaused?: boolean;
  registeredPublicKey?: string;
  lastTxBlockNumber?: number;
}) {
  const client = {
    getNonce: jest.fn(async () => '0x7'),
    getSpecVersion: jest.fn(async () => '0.10.2'),
    isAccountDeployed: jest.fn(async () => true),
    getBlockNumber: jest.fn(async () => 1000),
    getBlockTimestamp: jest.fn<Promise<number | undefined>, [number]>(
      async () => 1_780_000_000,
    ),
    isPoolPaused: jest.fn(async () => options?.isPoolPaused ?? false),
    getPoolFeeAmount: jest.fn(async () => PROTOCOL_FEE),
    getTokenBalance: jest.fn(
      async (): Promise<[string, string]> => ['10000000000000000000', '0'],
    ),
    getTransactionReceipt: jest.fn<Promise<unknown>, [string]>(
      async () => null,
    ),
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
      chainId: '0x534e5f4d41494e',
      feeMeta: { decimals: 18 },
    }),
    keyring: { deriveStrk20ViewingKey },
    buildPrivacyEncodedTx,
    buildTxTransferAssetAction: jest.fn(async (params: object) => ({
      type: 'assetTransfer',
      assetTransfer: {
        ...params,
        sends: (params as { transfers: { from: string }[] }).transfers.filter(
          (item) => item.from === ACCOUNT_ADDRESS,
        ),
        receives: (
          params as { transfers: { from: string }[] }
        ).transfers.filter((item) => item.from !== ACCOUNT_ADDRESS),
      },
    })),
  };
  getVault.mockResolvedValue(vault);

  const promptPasswordVerifyByAccount = jest.fn(async () => ({
    password: 'pw',
  }));
  const getCachedPasswordForBackgroundRead = jest.fn<
    Promise<string | undefined>,
    []
  >(async () => undefined);
  const backgroundApi = {
    serviceHardwareUI: {
      withHardwareProcessing: jest.fn(async (run: () => Promise<unknown>) =>
        run(),
      ),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn(async () => ({
        privacyPool: {
          sequencingCooldownBlocks: 10,
        },
      })),
    },
    servicePassword: {
      promptPasswordVerifyByAccount,
      getCachedPasswordForBackgroundRead,
    },
    serviceHistory: {
      getAccountLocalHistoryPendingTxs: jest.fn<
        Promise<import('@onekeyhq/shared/types/history').IAccountHistoryTx[]>,
        [object]
      >(async () => []),
      getAccountLocalHistoryConfirmedTxs: jest.fn<
        Promise<import('@onekeyhq/shared/types/history').IAccountHistoryTx[]>,
        [object]
      >(async () => []),
    },
    simpleDb: {
      localHistory: {
        batchUpdateLocalHistoryTxs: jest.fn(
          async (_params: unknown) => undefined,
        ),
      },
    },
    serviceToken: {
      fetchTokensDetails: jest.fn(async () => [
        {
          info: {
            address: STRK,
            name: 'Starknet',
            symbol: 'STRK',
            decimals: 18,
            isNative: true,
          },
        },
      ]),
    },
    serviceCustomRpc: {
      ensureLocalWalletRemoteConfigLoaded: jest.fn(async () => undefined),
    },
  };
  const service = new ServiceStarknetPrivacy({
    backgroundApi:
      backgroundApi as unknown as import('../../apis/IBackgroundApi').IBackgroundApi,
  });
  starknetPrivacy.getRecord.mockResolvedValue({
    networkId: NETWORK_ID,
    accountId: ACCOUNT_ID,
    lastTxBlockNumber: options?.lastTxBlockNumber,
    optInStatus: 'registered',
    registeredPublicKey: PUBLIC_KEY_X,
  });
  return {
    service,
    client,
    vault,
    backgroundApi,
    buildPrivacyEncodedTx,
    promptPasswordVerifyByAccount,
  };
}

const key = { networkId: NETWORK_ID, accountId: ACCOUNT_ID };

describe('prover HTTP idempotency header', () => {
  it('forwards the SDK key on the actual HTTP request and preserves it on retries', async () => {
    const { service } = build();
    const httpPost = jest.fn(async () => ({
      data: {
        data: {
          data: [{ success: true, status: 202, data: { jobId: 'test-job' } }],
        },
      },
    }));
    Object.assign(service, { getClient: async () => ({ post: httpPost }) });
    await service.buildRegisterTx(key);
    const [proxy] = jest.mocked(createStrk20ProverProxyFetch).mock.calls[0];
    const request: IProxyRequest = {
      networkId: NETWORK_ID,
      body: [
        {
          route: 'prover',
          params: {
            method: 'POST',
            url: '/prove',
            params: [],
            data: {},
            headers: { 'Idempotency-Key': 'test-key-preserved-0001' },
          },
        },
      ],
    };
    const signal = new AbortController().signal;
    await proxy.post(request, signal);
    await proxy.post(request, signal);
    expect(httpPost).toHaveBeenCalledTimes(2);
    for (const call of httpPost.mock.calls) {
      expect(call).toEqual([
        '/wallet/v1/proxy/wallet',
        request,
        {
          signal,
          headers: { 'Idempotency-Key': 'test-key-preserved-0001' },
        },
      ]);
    }
    httpPost.mockClear();
    const poll: IProxyRequest = {
      networkId: NETWORK_ID,
      body: [
        {
          route: 'prover',
          params: { method: 'GET', url: '/prove/test-job', params: [] },
        },
      ],
    };
    await proxy.post(poll, signal);
    expect(httpPost).toHaveBeenCalledWith('/wallet/v1/proxy/wallet', poll, {
      signal,
    });
  });
});
const previousBackgroundScope = globalThis.$onekeyIsInBackground;

beforeAll(() => {
  globalThis.$onekeyIsInBackground = true;
});

afterAll(() => {
  globalThis.$onekeyIsInBackground = previousBackgroundScope;
});

beforeEach(() => {
  jest.clearAllMocks();
  starknetPrivacy.patchRecord
    .mockReset()
    .mockImplementation(async ({ patch }: { patch: object }) => patch);
  jest.mocked(getStrk20HistoryTransfers).mockReset();
  jest.mocked(getStrk20HistoryTransfers).mockResolvedValue([]);
  starknetPrivacy.getRecord.mockResolvedValue(undefined);
  createProofInvocation.mockResolvedValue({ invocation: {}, registry: {} });
  executeWithInvocation.mockResolvedValue({
    callAndProof: {
      call: {
        contractAddress: MAINNET_POOL,
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
  it('checks the private send gate once, before requesting credentials, and preserves unavailable status', async () => {
    const { service, promptPasswordVerifyByAccount } = build();
    const sequencing = jest
      .spyOn(service, 'getSequencingState')
      .mockResolvedValue({
        status: EStrk20SequencingStatus.Unavailable,
        latestBlock: 0,
        blocksRemaining: 0,
        estimatedSecondsRemaining: 0,
      });
    await expect(
      service.buildPrivateTransferTx({
        ...key,
        kind: 'deposit',
        tokenAddress: STRK,
        amount: '1',
      }),
    ).rejects.toMatchObject({
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Unavailable },
    });
    expect(sequencing).toHaveBeenCalledTimes(1);
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });
  it('uses the original hardware processing flow and reuses empty-password device credentials', async () => {
    const { service, vault, backgroundApi, promptPasswordVerifyByAccount } =
      build();
    const deviceParams = {
      dbDevice: { connectId: 'test-connection', deviceId: 'test-device' },
      deviceCommonParams: {},
    };
    promptPasswordVerifyByAccount.mockResolvedValueOnce(
      Object.assign({ password: '' }, { deviceParams }),
    );
    await service.buildRegisterTx({
      ...key,
      accountId: "hw-1--m/44'/9004'/0'/0/0",
    });
    expect(vault.keyring.deriveStrk20ViewingKey).toHaveBeenCalledWith(
      expect.objectContaining({ password: '', deviceParams }),
    );
    expect(
      backgroundApi.serviceHardwareUI.withHardwareProcessing,
    ).toHaveBeenCalledTimes(1);
    const signer = checkIsDefined(
      jest.mocked(createStrk20Signer).mock.lastCall?.[0],
    );
    await expect(signer.resolvePassword()).resolves.toBe('');
    await expect(signer.resolveDeviceParams?.()).resolves.toBe(deviceParams);
    await expect(signer.resolvePassword()).resolves.toBe('');
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledWith({
      accountId: "hw-1--m/44'/9004'/0'/0/0",
      reason: EReasonForNeedPassword.CreateTransaction,
    });
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
    await expect(run(service)).rejects.toMatchObject({
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Waiting },
    });
    expect(createProofInvocation).not.toHaveBeenCalled();
  });
});

describe('buildRegisterTx mismatch rule', () => {
  it('supplies a latest-block pool nonce reader instead of a direct RPC URL', async () => {
    const { service, client } = build();
    await service.buildRegisterTx(key);
    const [params] = jest.mocked(createStrk20Transfers).mock.calls[0];
    await expect(params.getProofNonce?.()).resolves.toBe(7n);
    expect(client.getNonce).toHaveBeenCalledWith(MAINNET_POOL, 'latest');
    expect(params).not.toHaveProperty('nodeUrl');
  });

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

  it('honors a concurrent opt-out when restoring an already registered key', async () => {
    const { service } = build({ registeredPublicKey: PUBLIC_KEY_X });
    starknetPrivacy.patchRecord.mockResolvedValue({ optInStatus: 'none' });
    await expect(service.buildRegisterTx(key)).rejects.toMatchObject({
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Unavailable },
    });
    expect(createProofInvocation).not.toHaveBeenCalled();
  });
  it('marks registered without a second register when the pool key matches', async () => {
    const { service } = build({ registeredPublicKey: PUBLIC_KEY_X });

    await expect(service.buildRegisterTx(key)).resolves.toEqual({
      alreadyRegistered: true,
    });
    expect(starknetPrivacy.patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          optInStatus: 'registered',
          registeredPublicKey: PUBLIC_KEY_X,
        },
      }),
    );
    expect(createProofInvocation).not.toHaveBeenCalled();
  });
});

describe('register pending', () => {
  const TXID =
    '0x593f717be8ffc4966659dd53ff2708c8830687886dcd74a0c4807b7843ea74a';
  const pendingRecord = {
    networkId: NETWORK_ID,
    accountId: ACCOUNT_ID,
    accountAddress: ACCOUNT_ADDRESS,
    poolAddress: MAINNET_POOL,
    optInStatus: 'registerPending',
    registerTxid: TXID,
  };

  function buildPending(options: {
    receipt: unknown;
    submittedAgoMs?: number;
    registeredPublicKey?: string;
  }) {
    const built = build({ registeredPublicKey: options.registeredPublicKey });
    const getTransactionReceipt = jest.fn(async () => options.receipt);
    Object.assign(built.client, { getTransactionReceipt });
    starknetPrivacy.getRecord.mockResolvedValue({
      ...pendingRecord,
      registerSubmittedAt: Date.now() - (options.submittedAgoMs ?? 0),
    });
    starknetPrivacy.patchRecord.mockImplementation(
      async ({ patch }: { patch: object }) => ({ ...pendingRecord, ...patch }),
    );
    return { ...built, getTransactionReceipt };
  }

  it('records the submitted register tx as pending', async () => {
    const { service } = build();

    await service.noteRegisterSubmitted({
      ...key,
      poolAddress: MAINNET_POOL,
      txid: TXID,
    });

    expect(starknetPrivacy.patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        poolAddress: MAINNET_POOL,
        patch: expect.objectContaining({
          optInStatus: 'registerPending',
          registerTxid: TXID,
          registerSubmittedAt: expect.any(Number),
        }),
      }),
    );
  });

  it('settles to registered once the register tx is accepted', async () => {
    const { service, getTransactionReceipt } = buildPending({
      receipt: {
        finality_status: 'ACCEPTED_ON_L2',
        execution_status: 'SUCCEEDED',
      },
      registeredPublicKey: PUBLIC_KEY_X,
    });

    const state = await service.getAccountPrivacyState(key);

    expect(getTransactionReceipt).toHaveBeenCalledWith(TXID);
    expect(state.optInStatus).toBe('registered');
    expect(state.registeredPublicKey).toBe(PUBLIC_KEY_X);
  });

  it('keeps a successful receipt pending until the pool exposes its registered key', async () => {
    const { service } = buildPending({
      receipt: {
        finality_status: 'ACCEPTED_ON_L2',
        execution_status: 'SUCCEEDED',
      },
    });
    const state = await service.getAccountPrivacyState(key);
    expect(state.optInStatus).toBe('registerPending');
    expect(starknetPrivacy.patchRecord).not.toHaveBeenCalled();
  });

  it('falls back to consented when the register tx reverted', async () => {
    const { service } = buildPending({
      receipt: {
        finality_status: 'ACCEPTED_ON_L2',
        execution_status: 'REVERTED',
      },
    });

    const state = await service.getAccountPrivacyState(key);

    expect(state.optInStatus).toBe('consented');
    expect(state.registerTxid).toBe(TXID);
    expect(state.registerTxFailed).toBe(true);
  });

  it('keeps a missing receipt pending even after a long wait', async () => {
    const { service } = buildPending({
      receipt: null,
      submittedAgoMs: 20 * 60 * 1000,
    });

    const state = await service.getAccountPrivacyState(key);

    expect(state.optInStatus).toBe('registerPending');
    expect(state.registerTxid).toBe(TXID);
    expect(starknetPrivacy.patchRecord).not.toHaveBeenCalled();
  });

  it('stays pending while the receipt is not in yet', async () => {
    const { service } = buildPending({ receipt: null, submittedAgoMs: 5000 });

    const state = await service.getAccountPrivacyState(key);

    expect(state.optInStatus).toBe('registerPending');
    expect(starknetPrivacy.patchRecord).not.toHaveBeenCalled();
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
  const originalIntl = appLocale.intl;

  beforeAll(async () => {
    appLocale.setLocale('zh-CN', await loadLocaleMessages('zh-CN'));
  });

  afterAll(() => {
    appLocale.setLocale(originalIntl.locale, originalIntl.messages);
  });

  it.each([
    { tokenAddress: STRK, balance: '2500000000000000000' },
    { tokenAddress: ETH, balance: '1000000000000000000' },
  ])(
    'rejects a deposit without sufficient public STRK before authorization',
    async ({ tokenAddress, balance }) => {
      const { service, client, promptPasswordVerifyByAccount } = build();
      client.getTokenBalance.mockResolvedValue([balance, '0']);

      await expect(
        service.buildPrivateTransferTx({
          ...key,
          kind: 'deposit',
          tokenAddress,
          amount: '1000000000000000000',
        }),
      ).rejects.toMatchObject({
        key: 'send.error_insufficient_balance',
        info: { token: 'STRK' },
        message: 'STRK 余额不足',
      });

      expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
      expect(createProofInvocation).not.toHaveBeenCalled();
    },
  );

  it.each(['withdraw', 'transfer'] as const)(
    'rejects a %s without sufficient public STRK for protocol fee before authorization',
    async (kind) => {
      const { service, client, promptPasswordVerifyByAccount } = build();
      if (kind === 'transfer') {
        client.getPoolRegisteredPublicKey.mockResolvedValueOnce(PUBLIC_KEY_X);
      }
      client.getTokenBalance.mockResolvedValue(['1000000000000000000', '0']);

      await expect(
        service.buildPrivateTransferTx({
          ...key,
          kind,
          tokenAddress: ETH,
          amount: '100',
          ...(kind === 'transfer' ? { recipient: '0x2' } : {}),
        }),
      ).rejects.toMatchObject({
        key: 'send.error_insufficient_balance',
        info: { token: 'STRK' },
        message: 'STRK 余额不足',
      });

      expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
      expect(createProofInvocation).not.toHaveBeenCalled();
    },
  );

  it('rejects a non-STRK deposit without sufficient public token balance before authorization', async () => {
    const { service, client, promptPasswordVerifyByAccount } = build();
    client.getTokenBalance
      .mockResolvedValueOnce(['10000000000000000000', '0'])
      .mockResolvedValueOnce(['500', '0']);

    await expect(
      service.buildPrivateTransferTx({
        ...key,
        kind: 'deposit',
        tokenAddress: ETH,
        amount: '1000',
      }),
    ).rejects.toMatchObject({
      key: 'send.error_insufficient_balance',
      info: { token: 'ETH' },
    });

    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(createProofInvocation).not.toHaveBeenCalled();
  });

  it('sums fee and amount into one approve when depositing STRK', async () => {
    const { service, client, buildPrivacyEncodedTx } = build();

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
    expect(client.getPoolFeeAmount).toHaveBeenCalledTimes(1);
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
    client.getPoolRegisteredPublicKey.mockResolvedValueOnce(PUBLIC_KEY_X);

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

  it('rejects a recipient missing from the pool before requesting a proof', async () => {
    const { service, buildPrivacyEncodedTx } = build();

    await expect(
      service.buildPrivateTransferTx({
        ...key,
        kind: 'transfer',
        tokenAddress: ETH,
        amount: '3',
        recipient: ACCOUNT_ADDRESS,
      }),
    ).rejects.toMatchObject({
      data: {
        starknetPrivacyErrorCode: EStrk20ErrorCode.RecipientNotRegistered,
      },
    });
    expect(buildPrivacyEncodedTx).not.toHaveBeenCalled();
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
  it.each([false, true])(
    'reuses the unlocked software wallet for a cold balance (manual refresh: %s)',
    async (manual) => {
      const { service, backgroundApi, vault, promptPasswordVerifyByAccount } =
        build();
      backgroundApi.servicePassword.getCachedPasswordForBackgroundRead.mockResolvedValue(
        'cached-password',
      );
      discoverNotes.mockResolvedValue({
        notes: new Map([[BigInt(STRK), [{ amount: BigInt(4) }]]]),
      });

      await expect(
        manual
          ? service.refreshPrivateBalances({ ...key, allowPrompt: true })
          : service.getPrivateBalances(key),
      ).resolves.toMatchObject({
        byToken: { [STRK]: '4' },
      });
      expect(vault.keyring.deriveStrk20ViewingKey).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'cached-password' }),
      );
      expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
      expect(createProofInvocation).not.toHaveBeenCalled();
    },
  );

  it('shares one key derivation between app unlock, balances and history', async () => {
    const { service, vault, backgroundApi, promptPasswordVerifyByAccount } =
      build();
    starknetPrivacy.getRegisteredAccounts.mockResolvedValue([
      { ...key, poolAddress: MAINNET_POOL },
    ]);
    backgroundApi.servicePassword.getCachedPasswordForBackgroundRead.mockResolvedValue(
      'cached-password',
    );
    discoverNotes.mockResolvedValue({ notes: new Map() });
    jest.mocked(fetchStrk20HistoryPage).mockResolvedValue({
      transactions: [],
      cursor: { subchannels: [], historyComplete: true },
    });
    await Promise.all([
      service.prepareUnlockedViewingKeys(),
      service.getPrivateBalances(key),
      service.fetchPrivateHistory({ ...key, tokenAddress: STRK }),
    ]);
    expect(vault.keyring.deriveStrk20ViewingKey).toHaveBeenCalledTimes(1);
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('prepares software accounts at app unlock for a first visit after password expiry', async () => {
    const { service, vault, backgroundApi, promptPasswordVerifyByAccount } =
      build();
    starknetPrivacy.getRegisteredAccounts.mockResolvedValue([
      { ...key, poolAddress: MAINNET_POOL },
      { ...key, accountId: 'hw-1--starknet--0', poolAddress: MAINNET_POOL },
    ]);
    backgroundApi.servicePassword.getCachedPasswordForBackgroundRead.mockResolvedValueOnce(
      'cached-password',
    );
    await service.prepareUnlockedViewingKeys();
    expect(vault.keyring.deriveStrk20ViewingKey).toHaveBeenCalledTimes(1);
    expect(discoverNotes).not.toHaveBeenCalled();
    service.invalidatePendingAuthorizations();
    discoverNotes.mockResolvedValue({ notes: new Map() });
    await expect(service.getPrivateBalances(key)).resolves.toMatchObject({
      noteCount: 0,
    });
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('checks a silently derived key against the registered key before discovery', async () => {
    const { service, backgroundApi, promptPasswordVerifyByAccount } = build();
    backgroundApi.servicePassword.getCachedPasswordForBackgroundRead.mockResolvedValue(
      'cached-password',
    );
    starknetPrivacy.getRecord.mockResolvedValue({
      optInStatus: 'registered',
      registeredPublicKey: '0xdead',
    });

    await expect(service.getPrivateBalances(key)).rejects.toMatchObject({
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.KeyMismatch },
    });
    expect(discoverNotes).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('does not use the app password for a hardware wallet without a viewing key', async () => {
    const { service, backgroundApi, vault, promptPasswordVerifyByAccount } =
      build();
    backgroundApi.servicePassword.getCachedPasswordForBackgroundRead.mockResolvedValue(
      'cached-password',
    );

    await expect(
      service.getPrivateBalances({
        ...key,
        accountId: "hw-1--m/44'/9004'/0'/0/0",
      }),
    ).rejects.toMatchObject({
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
    });
    expect(vault.keyring.deriveStrk20ViewingKey).not.toHaveBeenCalled();
    expect(discoverNotes).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('allows an explicit registered-account refresh to unlock without creating a proof', async () => {
    const { service, promptPasswordVerifyByAccount } = build();
    starknetPrivacy.getRecord.mockResolvedValue({
      optInStatus: 'registered',
      registeredPublicKey: PUBLIC_KEY_X,
    });
    discoverNotes.mockResolvedValue({
      notes: new Map<bigint, { amount: bigint }[]>(),
    });
    await expect(
      service.refreshPrivateBalances({ ...key, allowPrompt: true }),
    ).resolves.toMatchObject({ noteCount: 0 });
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledWith({
      accountId: key.accountId,
      reason: EReasonForNeedPassword.Default,
    });
    expect(createProofInvocation).not.toHaveBeenCalled();
    expect(executeWithInvocation).not.toHaveBeenCalled();
  });

  it('never prompts or syncs an account that has opted out', async () => {
    const { service, promptPasswordVerifyByAccount } = build();
    starknetPrivacy.getRecord.mockResolvedValue({ optInStatus: 'none' });
    await expect(
      service.refreshPrivateBalances({ ...key, allowPrompt: true }),
    ).rejects.toMatchObject({ key: expect.any(String) });
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(discoverNotes).not.toHaveBeenCalled();
  });

  it('does not send a mismatching viewing key to Discovery after unlocking', async () => {
    const { service } = build();
    starknetPrivacy.getRecord.mockResolvedValue({
      optInStatus: 'registered',
      registeredPublicKey: '0xdead',
    });
    await expect(
      service.refreshPrivateBalances({ ...key, allowPrompt: true }),
    ).rejects.toMatchObject({ key: expect.any(String) });
    expect(discoverNotes).not.toHaveBeenCalled();
    await expect(service.refreshPrivateBalances(key)).rejects.toMatchObject({
      key: expect.any(String),
    });
    expect(discoverNotes).not.toHaveBeenCalled();
  });

  it('does not sync if privacy is turned off while unlocking', async () => {
    const { service } = build();
    starknetPrivacy.getRecord
      .mockResolvedValueOnce({ optInStatus: 'registered' })
      .mockResolvedValueOnce({ optInStatus: 'none' });
    await expect(
      service.refreshPrivateBalances({ ...key, allowPrompt: true }),
    ).rejects.toMatchObject({ key: expect.any(String) });
    expect(discoverNotes).not.toHaveBeenCalled();
  });
  it('refreshPrivateBalances throws locked on an empty cache', async () => {
    const { service, promptPasswordVerifyByAccount } = build();

    await expect(service.refreshPrivateBalances(key)).rejects.toThrow();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(discoverNotes).not.toHaveBeenCalled();
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

  it('reuses fresh display balances, then shares one discovery when they expire', async () => {
    const { service, promptPasswordVerifyByAccount } = build();
    const query = { ...key, tokenAddresses: [STRK] };
    starknetPrivacy.getRecord.mockResolvedValue({
      optInStatus: 'registered',
      registeredPublicKey: PUBLIC_KEY_X,
    });
    discoverNotes.mockResolvedValue({ notes: new Map() });
    const initial = await service.refreshPrivateBalances({
      ...query,
      allowPrompt: true,
    });

    await expect(service.getCachedPrivateBalances(query)).resolves.toEqual(
      initial,
    );
    await expect(service.getPrivateBalances(query)).resolves.toEqual(initial);
    await expect(
      service.getCachedPrivateBalances({ ...query, tokenAddresses: [ETH] }),
    ).resolves.toBeUndefined();
    await expect(
      service.getCachedPrivateBalances({
        ...query,
        accountId: 'another-account',
      }),
    ).resolves.toBeUndefined();
    expect(discoverNotes).toHaveBeenCalledTimes(1);

    const dateNow = jest
      .spyOn(Date, 'now')
      .mockReturnValue(initial.lastSyncedAt + 60_000);
    try {
      const results = await Promise.all([
        service.getPrivateBalances(query),
        service.getPrivateBalances(query),
      ]);
      expect(discoverNotes).toHaveBeenCalledTimes(2);
      expect(results[0].lastSyncedAt).toBe(Date.now());
      expect(results[1]).toEqual(results[0]);
      expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);

      dateNow.mockReturnValue(initial.lastSyncedAt + 2 * 60 * 60_000 + 1);
      service.invalidatePendingAuthorizations();
      await expect(service.getPrivateBalances(query)).resolves.toMatchObject({
        lastSyncedAt: Date.now(),
      });
      expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);

      await service.clearViewingKeyCache();
      await expect(
        service.getCachedPrivateBalances(query),
      ).resolves.toBeUndefined();
      await expect(service.getPrivateBalances(query)).rejects.toMatchObject({
        data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Locked },
      });
      expect(discoverNotes).toHaveBeenCalledTimes(3);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('uses the in-flight manual refresh instead of publishing an older snapshot', async () => {
    const { service } = build();
    starknetPrivacy.getRecord.mockResolvedValue({
      optInStatus: 'registered',
      registeredPublicKey: PUBLIC_KEY_X,
    });
    discoverNotes.mockResolvedValue({ notes: new Map() });
    await service.refreshPrivateBalances({ ...key, allowPrompt: true });

    const started = Promise.withResolvers<void>();
    const discovery = Promise.withResolvers<{
      notes: Map<bigint, { amount: bigint }[]>;
    }>();
    discoverNotes.mockImplementationOnce(() => {
      started.resolve();
      return discovery.promise;
    });
    const manual = service.refreshPrivateBalances({
      ...key,
      allowPrompt: true,
    });
    await started.promise;
    const automatic = service.getPrivateBalances(key);
    discovery.resolve({ notes: new Map([[BigInt(STRK), [{ amount: 10n }]]]) });

    const [manualSnapshot, automaticSnapshot] = await Promise.all([
      manual,
      automatic,
    ]);
    expect(automaticSnapshot).toEqual(manualSnapshot);
    expect(automaticSnapshot.byToken[STRK]).toBe('10');
    expect(discoverNotes).toHaveBeenCalledTimes(2);
  });
});

describe('submitted private transfers', () => {
  const pending = {
    txid: '0xabc',
    kind: 'deposit',
    status: 'pending',
    submittedAt: 123,
  };
  function pendingTransfer(receipt: unknown) {
    const fixture = build();
    const record = {
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      poolAddress: MAINNET_POOL,
      accountAddress: ACCOUNT_ADDRESS,
      optInStatus: 'registered',
      registeredPublicKey: PUBLIC_KEY_X,
      lastTransfer: pending,
    };
    starknetPrivacy.getRecord.mockResolvedValue(record);
    starknetPrivacy.patchRecord.mockImplementation(
      async ({ patch }: { patch: object }) => ({ ...record, ...patch }),
    );
    fixture.client.getTransactionReceipt.mockResolvedValue(receipt);
    return fixture;
  }
  it('persists only the public transaction identity after submission', async () => {
    const { service } = build();
    await service.notePrivateTransferSubmitted({
      ...key,
      poolAddress: MAINNET_POOL,
      txid: '0xabc',
      kind: 'deposit',
    });
    expect(starknetPrivacy.patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          lastTransfer: { ...pending, submittedAt: expect.any(Number) },
        },
      }),
    );
  });
  it('retains a missing receipt as pending and blocks another proof', async () => {
    const { service } = pendingTransfer(null);
    expect(
      (await service.getAccountPrivacyState(key)).lastTransfer?.status,
    ).toBe('pending');
    await expect(
      service.buildPrivateTransferTx({
        ...key,
        kind: 'deposit',
        tokenAddress: STRK,
        amount: '1',
      }),
    ).rejects.toBeDefined();
    expect(createProofInvocation).not.toHaveBeenCalled();
  });
  it('settles a successful receipt and starts the cooldown', async () => {
    const { service } = pendingTransfer({
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L2',
      block_number: 999,
    });
    const state = await service.getAccountPrivacyState(key);
    expect(state.lastTransfer?.status).toBe('confirmed');
    expect(state.lastTxBlockNumber).toBe(999);
    expect(starknetPrivacy.patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({ expected: { lastTransferTxid: '0xabc' } }),
    );
  });
  it('keeps privacy enabled after an explicit failed transfer', async () => {
    const { service } = pendingTransfer({
      execution_status: 'REVERTED',
      finality_status: 'ACCEPTED_ON_L2',
      block_number: 999,
    });
    const state = await service.getAccountPrivacyState(key);
    expect(state.optInStatus).toBe('registered');
    expect(state.lastTransfer?.status).toBe('failed');
  });
  it('refuses to prompt or prove after opt-out', async () => {
    const { service, promptPasswordVerifyByAccount } = build();
    starknetPrivacy.getRecord.mockResolvedValue({ optInStatus: 'none' });
    await expect(
      service.buildPrivateTransferTx({
        ...key,
        kind: 'deposit',
        tokenAddress: STRK,
        amount: '1',
      }),
    ).rejects.toBeDefined();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(createProofInvocation).not.toHaveBeenCalled();
  });
  it('checks the remote switch again before broadcast', async () => {
    const { service } = build();
    Object.assign(service, { isDisabledByServer: async () => true });
    await expect(
      service.assertPrivacyTxCanSubmit({ ...key, kind: 'deposit' }),
    ).rejects.toBeDefined();
  });
});

describe('private history display', () => {
  it('rejects a registration snapshot started before opting out', async () => {
    const { service, vault } = build();
    const readStarted = Promise.withResolvers<void>();
    const finishRead =
      Promise.withResolvers<
        Awaited<ReturnType<typeof service.getAccountPrivacyState>>
      >();
    const registered = await service.getAccountPrivacyState(key);
    jest.spyOn(service, 'getAccountPrivacyState').mockImplementationOnce(() => {
      readStarted.resolve();
      return finishRead.promise;
    });
    const reading = service.fetchPrivateHistory({ ...key, tokenAddress: STRK });
    await readStarted.promise;
    await service.optOut(key);
    finishRead.resolve(registered);
    await expect(reading).rejects.toBeDefined();
    expect(fetchStrk20HistoryPage).not.toHaveBeenCalled();
    expect(vault.keyring.deriveStrk20ViewingKey).not.toHaveBeenCalled();
  });

  it('blocks discovery on an incompatible RPC before deriving a viewing key', async () => {
    const { service, client, vault } = build();
    client.getSpecVersion.mockResolvedValue('0.8.0');
    await expect(
      service.fetchPrivateHistory({ ...key, tokenAddress: STRK }),
    ).rejects.toBeDefined();
    expect(fetchStrk20HistoryPage).not.toHaveBeenCalled();
    expect(vault.keyring.deriveStrk20ViewingKey).not.toHaveBeenCalled();
  });

  it.each([1_780_000_000, undefined])(
    'keeps token history and pagination with block timestamp %s',
    async (seconds) => {
      const { service, backgroundApi, vault, client } = build();
      client.getBlockTimestamp.mockResolvedValue(seconds);
      await service.buildRegisterTx(key);
      const cursor = { subchannels: [], historyComplete: false };
      jest.mocked(fetchStrk20HistoryPage).mockResolvedValue({
        transactions: [1n, 2n].map((transactionHash) => ({
          transactionHash,
          blockNumber: 100,
          notes: [],
          deposits: [],
          withdrawals: [],
          openNoteDeposits: [],
        })),
        cursor,
      });
      jest.mocked(getStrk20HistoryTransfers).mockResolvedValue([
        {
          kind: 'transfer',
          from: BigInt(ACCOUNT_ADDRESS),
          to: 123n,
          token: BigInt(STRK),
          amount: 1_500_000_000_000_000_000n,
        },
        {
          kind: 'transfer',
          from: 123n,
          to: BigInt(ACCOUNT_ADDRESS),
          token: BigInt(ETH),
          amount: 999n,
        },
      ]);
      const state = jest.spyOn(service, 'getAccountPrivacyState');
      const result = await service.fetchPrivateHistory({
        ...key,
        tokenAddress: STRK,
      });
      expect(state).toHaveBeenCalledTimes(1);
      expect(result.discoveryTxIds).toEqual(result.txs.map((tx) => tx.id));
      expect(result.hasMore).toBe(true);
      expect(result.cursor).toEqual({ cursorId: expect.any(String) });
      expect(JSON.stringify(result.cursor)).not.toContain('channelKey');
      expect(result.txs).toHaveLength(2);
      expect(
        backgroundApi.serviceToken.fetchTokensDetails,
      ).toHaveBeenCalledTimes(1);
      expect(vault.buildTxTransferAssetAction).toHaveBeenCalledWith(
        expect.objectContaining({
          transfers: [
            expect.objectContaining({
              amount: '1.5',
              symbol: 'STRK',
              tokenIdOnNetwork: STRK,
            }),
          ],
        }),
      );
      expect(result.txs[0].decodedTx.block).toBe(100);
      expect(result.txs.map((tx) => tx.decodedTx.createdAt)).toEqual(
        [seconds, seconds].map((time) =>
          time === undefined ? undefined : time * 1000,
        ),
      );
      expect(client.getBlockTimestamp).toHaveBeenCalledWith(100);
      expect(result.txs[0].decodedTx.totalFeeInNative).toBeUndefined();
    },
  );
  it('does not manufacture a zero-value row for a synthetic registration', async () => {
    const { service, backgroundApi } = build();
    await service.buildRegisterTx(key);
    jest.mocked(fetchStrk20HistoryPage).mockResolvedValue({
      transactions: [
        {
          transactionHash: 0n,
          blockNumber: 100,
          notes: [],
          deposits: [],
          withdrawals: [],
          openNoteDeposits: [],
          registeredPubkey: 1n,
        },
      ],
      cursor: { subchannels: [], historyComplete: true },
    });
    const result = await service.fetchPrivateHistory({
      ...key,
      tokenAddress: STRK,
    });
    expect(result.txs).toEqual([]);
    expect(
      backgroundApi.serviceToken.fetchTokensDetails,
    ).not.toHaveBeenCalled();
  });
});

it('resumes an existing registration without creating a proof', async () => {
  const { service } = build({ registeredPublicKey: PUBLIC_KEY_X });
  await expect(
    service.buildRegisterTx({ ...key, resumeOnly: true }),
  ).resolves.toEqual({ alreadyRegistered: true });
  expect(createProofInvocation).not.toHaveBeenCalled();
});
it('never silently turns resume into a paid registration', async () => {
  const { service } = build();
  await expect(
    service.buildRegisterTx({ ...key, resumeOnly: true }),
  ).rejects.toBeDefined();
  expect(createProofInvocation).not.toHaveBeenCalled();
});

it.each([
  ['deposit', ACCOUNT_ADDRESS, MAINNET_POOL, 'receives'],
  ['withdraw', MAINNET_POOL, ACCOUNT_ADDRESS, 'sends'],
  ['transfer', '0x7b', ACCOUNT_ADDRESS, 'receives'],
] as const)(
  'projects %s from the private balance and preserves the real source',
  async (kind, from, to, direction) => {
    const { service } = build();
    await service.buildRegisterTx(key);
    jest.mocked(fetchStrk20HistoryPage).mockResolvedValue({
      transactions: [
        {
          transactionHash: 1n,
          blockNumber: 100,
          notes: [],
          deposits: [],
          withdrawals: [],
          openNoteDeposits: [],
        },
      ],
      cursor: { subchannels: [], historyComplete: true },
    });
    jest.mocked(getStrk20HistoryTransfers).mockResolvedValue([
      {
        kind,
        from: BigInt(from),
        to: BigInt(to),
        token: BigInt(STRK),
        amount: 3_000_000_000_000_000_000n,
      },
    ]);
    const { txs } = await service.fetchPrivateHistory({
      ...key,
      tokenAddress: STRK,
    });
    expect(
      txs[0].decodedTx.actions[0].assetTransfer?.[direction][0].amount,
    ).toBe('3');
    expect(BigInt(txs[0].decodedTx.signer)).toBe(BigInt(from));
  },
);

it.each([
  [null, EDecodedTxStatus.Pending],
  [
    { execution_status: 'REVERTED', finality_status: 'ACCEPTED_ON_L2' },
    EDecodedTxStatus.Failed,
  ],
  [
    {
      execution_status: 'SUCCEEDED',
      finality_status: 'ACCEPTED_ON_L2',
      block_number: 44,
      actual_fee: { unit: 'FRI', amount: '0xde0b6b3a7640000' },
    },
    EDecodedTxStatus.Confirmed,
  ],
] as const)(
  'keeps local private history when Discovery has no row and settles its receipt',
  async (receipt, expectedStatus) => {
    const { service, client, backgroundApi } = build();
    await service.buildRegisterTx(key);
    client.getTransactionReceipt.mockResolvedValue(receipt);
    jest.mocked(fetchStrk20HistoryPage).mockResolvedValue({
      transactions: [],
      cursor: { subchannels: [], historyComplete: true },
    });
    backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs.mockResolvedValue(
      [
        {
          id: 'local-private',
          isLocalCreated: true,
          decodedTx: {
            txid: '0x123',
            owner: ACCOUNT_ADDRESS,
            signer: ACCOUNT_ADDRESS,
            networkId: NETWORK_ID,
            accountId: ACCOUNT_ID,
            nonce: 0,
            status: EDecodedTxStatus.Pending,
            totalFeeInNative: '2',
            extraInfo: {
              privacy: {
                kind: 'transfer',
                poolAddress: MAINNET_POOL,
                tokenAddress: STRK,
                amount: '10000000000000000000',
                recipient: '0x7b',
              },
            },
            actions: [
              {
                type: 'assetTransfer',
                assetTransfer: {
                  from: ACCOUNT_ADDRESS,
                  to: '0x7b',
                  sends: [
                    {
                      from: ACCOUNT_ADDRESS,
                      to: '0x7b',
                      amount: '10',
                      tokenIdOnNetwork: STRK,
                    },
                  ],
                  receives: [],
                },
              },
            ],
          },
        },
      ] as unknown as import('@onekeyhq/shared/types/history').IAccountHistoryTx[],
    );
    const { txs, discoveryTxIds } = await service.fetchPrivateHistory({
      ...key,
      tokenAddress: STRK,
    });
    expect(discoveryTxIds).toEqual([]);
    expect(txs).toHaveLength(1);
    expect(txs[0].decodedTx.status).toBe(expectedStatus);
    expect(txs[0].decodedTx.actions[0].assetTransfer?.sends[0].amount).toBe(
      '10',
    );
    if (expectedStatus === EDecodedTxStatus.Confirmed) {
      const saved = expect.objectContaining({
        id: 'local-private',
        decodedTx: expect.objectContaining({
          status: EDecodedTxStatus.Confirmed,
          totalFeeInNative: '1',
          block: 44,
          isFinal: true,
        }),
      });
      expect(
        backgroundApi.simpleDb.localHistory.batchUpdateLocalHistoryTxs,
      ).toHaveBeenCalledWith([
        {
          networkId: NETWORK_ID,
          accountAddress: ACCOUNT_ADDRESS,
          confirmedTxs: [saved],
          confirmedTxsToSave: [saved],
        },
      ]);
    }
    expect(
      backgroundApi.simpleDb.localHistory.batchUpdateLocalHistoryTxs,
    ).toHaveBeenCalledTimes(
      expectedStatus === EDecodedTxStatus.Pending ? 0 : 1,
    );
  },
);

it('does not repopulate the viewing-key cache when derivation finishes after a lock', async () => {
  const { service, vault } = build();
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let finish!: (value: {
    viewingKey: string;
    publicKeyX: string;
    counter: number;
  }) => void;
  vault.keyring.deriveStrk20ViewingKey.mockImplementationOnce(async () => {
    entered();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const building = service.buildRegisterTx(key);
  await started;
  await service.clearViewingKeyCache();
  finish({ viewingKey: VIEWING_KEY, publicKeyX: PUBLIC_KEY_X, counter: 0 });
  await expect(building).rejects.toBeDefined();
  await expect(service.refreshPrivateBalances(key)).rejects.toBeDefined();
  expect(discoverNotes).not.toHaveBeenCalled();
});

it('does not build a transaction from a proof that completed after a lock', async () => {
  const { service, buildPrivacyEncodedTx } = build();
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let finish!: (value: object) => void;
  executeWithInvocation.mockImplementationOnce(async () => {
    entered();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const building = service.buildPrivateTransferTx({
    ...key,
    kind: 'withdraw',
    tokenAddress: STRK,
    amount: '1',
  });
  await started;
  await service.clearViewingKeyCache();
  finish({});
  await expect(building).rejects.toBeDefined();
  expect(buildPrivacyEncodedTx).not.toHaveBeenCalled();
});

it('keeps paid fees and the local privacy intent when Discovery replaces the same transaction', async () => {
  const { service, backgroundApi } = build();
  await service.buildRegisterTx(key);
  jest.mocked(fetchStrk20HistoryPage).mockResolvedValue({
    transactions: [
      {
        transactionHash: 1n,
        blockNumber: 100,
        notes: [],
        deposits: [],
        withdrawals: [],
        openNoteDeposits: [],
      },
    ],
    cursor: { subchannels: [], historyComplete: true },
  });
  jest.mocked(getStrk20HistoryTransfers).mockResolvedValue([
    {
      kind: 'transfer',
      from: BigInt(ACCOUNT_ADDRESS),
      to: 123n,
      token: BigInt(STRK),
      amount: 1_000_000_000_000_000_000n,
    },
  ]);
  backgroundApi.serviceHistory.getAccountLocalHistoryConfirmedTxs.mockResolvedValue(
    [
      {
        id: 'local',
        isLocalCreated: true,
        decodedTx: {
          txid: '0x01',
          owner: ACCOUNT_ADDRESS,
          signer: ACCOUNT_ADDRESS,
          networkId: NETWORK_ID,
          accountId: ACCOUNT_ID,
          nonce: 7,
          actions: [],
          status: EDecodedTxStatus.Confirmed,
          totalFeeInNative: '2.2',
          totalFeeFiatValue: '0.1',
          createdAt: 100,
          extraInfo: {
            privacy: {
              kind: 'transfer',
              poolAddress: MAINNET_POOL,
              tokenAddress: STRK,
              amount: '1000000000000000000',
              recipient: '0x7b',
              protocolFee: PROTOCOL_FEE,
            },
          },
        },
      },
    ],
  );
  const result = await service.fetchPrivateHistory({
    ...key,
    tokenAddress: STRK,
  });
  expect(result.txs).toHaveLength(1);
  expect(result.txs[0].decodedTx).toMatchObject({
    totalFeeInNative: '2.2',
    totalFeeFiatValue: '0.1',
    nonce: 7,
    createdAt: 100,
    extraInfo: { privacy: { protocolFee: PROTOCOL_FEE, tokenAddress: STRK } },
  });
  expect(result.txs[0].isLocalCreated).toBe(true);
});

it('uses the receipt fee instead of the estimate when private-history polling confirms a local transfer', async () => {
  const { service, client, backgroundApi } = build();
  await service.buildRegisterTx(key);
  client.getTransactionReceipt.mockResolvedValue({
    execution_status: 'SUCCEEDED',
    finality_status: 'ACCEPTED_ON_L2',
    actual_fee: { amount: '0xde0b6b3a7640000', unit: 'FRI' },
  });
  jest.mocked(fetchStrk20HistoryPage).mockResolvedValue({
    transactions: [],
    cursor: { subchannels: [], historyComplete: true },
  });
  backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs.mockResolvedValue(
    [
      {
        id: 'local',
        isLocalCreated: true,
        decodedTx: {
          txid: '0x01',
          owner: ACCOUNT_ADDRESS,
          signer: ACCOUNT_ADDRESS,
          networkId: NETWORK_ID,
          accountId: ACCOUNT_ID,
          nonce: 7,
          actions: [],
          status: EDecodedTxStatus.Pending,
          totalFeeInNative: '2',
          totalFeeFiatValue: '0.1',
          extraInfo: {
            privacy: {
              kind: 'transfer',
              poolAddress: MAINNET_POOL,
              tokenAddress: STRK,
              amount: '1000000000000000000',
              recipient: '0x7b',
              protocolFee: PROTOCOL_FEE,
            },
          },
        },
      },
    ],
  );
  const result = await service.fetchPrivateHistory({
    ...key,
    tokenAddress: STRK,
  });
  expect(result.txs[0].decodedTx).toMatchObject({
    status: EDecodedTxStatus.Confirmed,
    totalFeeInNative: '1',
    totalFeeFiatValue: '0.05',
  });
});
