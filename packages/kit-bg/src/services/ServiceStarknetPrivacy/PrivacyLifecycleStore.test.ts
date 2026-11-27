const starknetPrivacy = {
  getRecord: jest.fn(),
  patchRecord: jest.fn(),
  recordConsent: jest.fn(),
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

// eslint-disable-next-line import/first
import {
  EStrk20AccountPhase,
  EStrk20OptInStatus,
  EStrk20SequencingStatus,
  EStrk20TxGateStatus,
  type IStrk20AccountPrivacyState,
  type IStrk20SequencingState,
} from '@onekeyhq/shared/types/starknetPrivacy';

// eslint-disable-next-line import/first
import {
  PrivacyLifecycleStore,
  deriveAccountPrivacySnapshot,
} from './PrivacyLifecycleStore';

const BASE_STATE: IStrk20AccountPrivacyState = {
  profileId: 'account-leaf-v1',
  version: 1,
  networkId: 'starknet--mainnet',
  accountId: 'hd-1--m/44/9004/0/0/0',
  chainId: '0x534e5f4d41494e',
  accountAddress: '0x1234',
  poolAddress: '0xpool',
  keyIndex: 0,
  accountKeyScheme: 'stark-curve',
  accountKeyFingerprint: 'fp',
  optInStatus: EStrk20OptInStatus.None,
};

const READY_SEQUENCING: IStrk20SequencingState = {
  status: EStrk20SequencingStatus.Ready,
  latestBlock: 1000,
  blocksRemaining: 0,
  estimatedSecondsRemaining: 0,
  provingBlockId: 991,
};

describe('deriveAccountPrivacySnapshot (explicit dual state machine)', () => {
  it('returns unavailable when privacy is disabled or state is absent', () => {
    expect(
      deriveAccountPrivacySnapshot({
        available: false,
        state: BASE_STATE,
        sequencing: READY_SEQUENCING,
        isKeyLoaded: true,
        isSubmitting: false,
      }),
    ).toMatchObject({
      phase: EStrk20AccountPhase.Unavailable,
      txGate: { status: EStrk20TxGateStatus.Idle },
      hasConsented: false,
    });
  });

  it.each([
    {
      name: 'activation_required when deployment is required and no activation tx is pending',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.None },
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.ActivationRequired,
      },
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.ActivationRequired,
    },
    {
      name: 'activating when activationTxid is recorded',
      state: {
        ...BASE_STATE,
        optInStatus: EStrk20OptInStatus.None,
        activationTxid: '0xact',
      },
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.Waiting,
        blocksRemaining: 10,
      },
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.Activating,
    },
    {
      name: 'not_opted_in when deployed and not yet registered',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.Consented },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.NotOptedIn,
    },
    {
      name: 'registering when register tx is pending',
      state: {
        ...BASE_STATE,
        optInStatus: EStrk20OptInStatus.RegisterPending,
        registerTxid: '0xreg',
      },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.Registering,
    },
    {
      name: 'key_locked when registered on-chain but viewing key is not loaded',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.Registered },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.KeyLocked,
    },
    {
      name: 'ready when registered and viewing key is loaded in memory',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.Registered },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: true,
      expectedPhase: EStrk20AccountPhase.Ready,
    },
    {
      name: 'key_mismatch takes terminal precedence over everything else',
      state: {
        ...BASE_STATE,
        optInStatus: EStrk20OptInStatus.Mismatch,
        activationTxid: '0xact',
      },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: true,
      expectedPhase: EStrk20AccountPhase.KeyMismatch,
    },
  ])('derives $name', ({ state, sequencing, isKeyLoaded, expectedPhase }) => {
    const snapshot = deriveAccountPrivacySnapshot({
      available: true,
      state,
      sequencing,
      isKeyLoaded,
      isSubmitting: false,
    });
    expect(snapshot.phase).toBe(expectedPhase);
  });

  it('derives orthogonal txGate transitions (submitting > pending_tx > cooldown > idle)', () => {
    const registeredState: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.Registered,
    };

    expect(
      deriveAccountPrivacySnapshot({
        available: true,
        state: registeredState,
        sequencing: READY_SEQUENCING,
        isKeyLoaded: true,
        isSubmitting: true,
      }).txGate.status,
    ).toBe(EStrk20TxGateStatus.Submitting);

    const pendingTransfer = {
      txid: '0xtx1',
      kind: 'transfer' as const,
      status: 'pending' as const,
      submittedAt: 1000,
    };
    const pendingSnap = deriveAccountPrivacySnapshot({
      available: true,
      state: { ...registeredState, lastTransfer: pendingTransfer },
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.Waiting,
        blocksRemaining: 10,
      },
      isKeyLoaded: true,
      isSubmitting: false,
    });
    expect(pendingSnap.txGate.status).toBe(EStrk20TxGateStatus.PendingTx);
    expect(pendingSnap.txGate.pendingTx).toEqual(pendingTransfer);

    const cooldownSnap = deriveAccountPrivacySnapshot({
      available: true,
      state: registeredState,
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.Waiting,
        blocksRemaining: 4,
        estimatedSecondsRemaining: 8,
      },
      isKeyLoaded: true,
      isSubmitting: false,
    });
    expect(cooldownSnap.txGate).toMatchObject({
      status: EStrk20TxGateStatus.Cooldown,
      blocksRemaining: 4,
      estimatedSecondsRemaining: 8,
    });

    expect(
      deriveAccountPrivacySnapshot({
        available: true,
        state: registeredState,
        sequencing: READY_SEQUENCING,
        isKeyLoaded: true,
        isSubmitting: false,
      }).txGate,
    ).toMatchObject({
      status: EStrk20TxGateStatus.Idle,
      provingBlockId: 991,
    });
  });
});

describe('PrivacyLifecycleStore dropped pending tx expiry', () => {
  const ACCOUNT_KEY = {
    networkId: BASE_STATE.networkId,
    accountId: BASE_STATE.accountId,
  };

  function createStore(options?: {
    receipt?: unknown;
    latestBlock?: number;
    validityBlocks?: number;
    registeredPublicKey?: string;
    record?: IStrk20AccountPrivacyState;
  }) {
    const client = {
      getTransactionReceipt: jest.fn(async () => options?.receipt ?? null),
      getBlockNumber: jest.fn(async () => options?.latestBlock ?? 1000),
      getPoolProofValidityBlocks: jest.fn(
        async () => options?.validityBlocks ?? 100,
      ),
      getPoolRegisteredPublicKey: jest.fn(
        async () => options?.registeredPublicKey,
      ),
      isAccountDeployed: jest.fn(async () => true),
    };
    const vault = {
      getClient: jest.fn(async () => client),
      getAccountAddress: jest.fn(async () => BASE_STATE.accountAddress),
      getAccount: jest.fn(async () => ({
        address: BASE_STATE.accountAddress,
        path: 'm/0',
      })),
      getNetwork: jest.fn(async () => ({ chainId: BASE_STATE.chainId })),
    };
    starknetPrivacy.getRecord.mockReset().mockResolvedValue(options?.record);
    starknetPrivacy.patchRecord
      .mockReset()
      .mockImplementation(async ({ patch }: { patch: object }) =>
        options?.record ? { ...options.record, ...patch } : undefined,
      );

    const store = new PrivacyLifecycleStore({
      getPrivacyConfig: jest.fn(async () => undefined),
      getPrivacyPoolSettings: jest.fn(async () => ({
        sequencingCooldownBlocks: 10,
      })),
      resolvePoolAddress: jest.fn(async () => BASE_STATE.poolAddress),
      isDisabledByServer: jest.fn(async () => false),
      getStarknetVault: jest.fn(
        async () =>
          vault as unknown as import('../../vaults/impls/starknet/Vault').default,
      ),
      isKeyLoaded: jest.fn(() => true),
      dropCachedViewingKey: jest.fn(),
    });

    return {
      store,
      client,
      getRecord: starknetPrivacy.getRecord,
      patchRecord: starknetPrivacy.patchRecord,
    };
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('releases a dropped pending transfer once latestBlock exceeds provingBlockId + validityWindow', async () => {
    const record: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.Registered,
      lastTransfer: {
        txid: '0xdropped',
        kind: 'transfer',
        status: 'pending',
        submittedAt: Date.now() - 60_000,
        provingBlockId: 800,
      },
    };
    const { store, patchRecord } = createStore({
      record,
      receipt: null,
      latestBlock: 901,
      validityBlocks: 100,
    });

    const state = await store.getAccountPrivacyState(ACCOUNT_KEY);
    expect(state.lastTransfer?.status).toBe('failed');
    expect(patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        expected: { lastTransferTxid: '0xdropped' },
        patch: {
          lastTransfer: expect.objectContaining({
            txid: '0xdropped',
            status: 'failed',
          }),
        },
      }),
    );
  });

  it('keeps a pending transfer blocked while still within provingBlockId + validityWindow', async () => {
    const record: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.Registered,
      lastTransfer: {
        txid: '0xinflight',
        kind: 'deposit',
        status: 'pending',
        submittedAt: Date.now() - 60_000,
        provingBlockId: 800,
      },
    };
    const { store, patchRecord } = createStore({
      record,
      receipt: null,
      latestBlock: 900,
      validityBlocks: 100,
    });

    const state = await store.getAccountPrivacyState(ACCOUNT_KEY);
    expect(state.lastTransfer?.status).toBe('pending');
    expect(patchRecord).not.toHaveBeenCalled();
  });

  it('keeps a pending transfer blocked when RPC returns a non-final RECEIVED receipt', async () => {
    const record: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.Registered,
      lastTransfer: {
        txid: '0xreceived',
        kind: 'transfer',
        status: 'pending',
        submittedAt: Date.now() - 2 * 60 * 60 * 1000,
        provingBlockId: 800,
      },
    };
    const { store, patchRecord } = createStore({
      record,
      receipt: { finality_status: 'RECEIVED', execution_status: 'SUCCEEDED' },
      latestBlock: 1200,
      validityBlocks: 100,
    });

    const state = await store.getAccountPrivacyState(ACCOUNT_KEY);
    expect(state.lastTransfer?.status).toBe('pending');
    expect(patchRecord).not.toHaveBeenCalled();
  });

  it('releases a dropped pending registration after proof validity expires when no on-chain key exists', async () => {
    const record: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.RegisterPending,
      registerTxid: '0xreg-dropped',
      registerSubmittedAt: Date.now() - 60_000,
      registerProvingBlockId: 800,
    };
    const { store, patchRecord } = createStore({
      record,
      receipt: null,
      latestBlock: 901,
      validityBlocks: 100,
      registeredPublicKey: undefined,
    });

    const state = await store.getAccountPrivacyState(ACCOUNT_KEY);
    expect(state.optInStatus).toBe(EStrk20OptInStatus.Consented);
    expect(state.registerTxFailed).toBe(true);
    expect(patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        expected: {
          optInStatus: EStrk20OptInStatus.RegisterPending,
          registerTxid: '0xreg-dropped',
        },
        patch: {
          optInStatus: EStrk20OptInStatus.Consented,
          registerTxFailed: true,
        },
      }),
    );
  });

  it('settles an expired missing-receipt registration to Registered when the pool already holds the key', async () => {
    const record: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.RegisterPending,
      registerTxid: '0xreg-landed',
      registerSubmittedAt: Date.now() - 60_000,
      registerProvingBlockId: 800,
    };
    const { store } = createStore({
      record,
      receipt: null,
      latestBlock: 950,
      validityBlocks: 100,
      registeredPublicKey: '0xpub',
    });

    const state = await store.getAccountPrivacyState(ACCOUNT_KEY);
    expect(state.optInStatus).toBe(EStrk20OptInStatus.Registered);
    expect(state.registeredPublicKey).toBe('0xpub');
    expect(state.registerTxFailed).toBe(false);
  });

  it('releases a legacy pending transfer without provingBlockId after the safety timeout', async () => {
    const record: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.Registered,
      lastTransfer: {
        txid: '0xlegacy-dropped',
        kind: 'withdraw',
        status: 'pending',
        submittedAt: Date.now() - 61 * 60 * 1000,
      },
    };
    const { store } = createStore({
      record,
      receipt: null,
    });

    const state = await store.getAccountPrivacyState(ACCOUNT_KEY);
    expect(state.lastTransfer?.status).toBe('failed');
  });
});
