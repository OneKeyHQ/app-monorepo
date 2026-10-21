import {
  XMR_BUILT_IN_NODE_URLS,
  XMR_SYNC_STEP_BLOCKS,
} from '@onekeyhq/shared/src/config/xmr';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';

import { buildXmrLocalWalletCapability } from './localWallet';

import type Vault from './Vault';

jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime', () => ({
  hasXmrRuntimeApiLoader: () => true,
  readXmrRuntimeError: jest.requireActual(
    '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime',
  ).readXmrRuntimeError,
}));

let peek: {
  scannedToHeight: number | null;
  ranges: { start: number; end: number }[];
  birthdayHeight?: number;
} = {
  scannedToHeight: null,
  ranges: [],
};
const runtime = {
  listAccounts: async () =>
    JSON.stringify({ items: [{ accountId: 3, uuid: 'acc' }] }),
  chainTip: async () => JSON.stringify({ height: 3_767_827 }),
  syncPeek: async () => JSON.stringify(peek),
  updateChainTip: jest.fn(async () => '{}'),
  rewindTo: jest.fn(async () => '{}'),
  addAccount: jest.fn(async () => '{}'),
  removeAccount: jest.fn(async () => '{"removed":true}'),
  history: jest.fn(async (_id: string, _limit: number, _offset: number) =>
    JSON.stringify({ items: [], total: 0 }),
  ),
  syncStep: jest.fn(async (_accountId: string, _maxBlocks: string) =>
    JSON.stringify({ blocksScanned: 10, done: false, outputsFound: 0 }),
  ),
  diagDatabase: jest.fn(async () =>
    JSON.stringify({ counts: {}, logicalBytes: 4_096_000 }),
  ),
  balance: async () =>
    JSON.stringify({
      totalAtomic: '2000000000000',
      unlockedAtomic: '1000000000000',
      unverifiableAtomic: '500000000000',
      pendingChangeAtomic: '300000000000',
    }),
};

// Stale-first is unit-tested in runtime.test.ts; here it passes through,
// except when a test flips `mockBusy` to see what a UI read gets mid-step.
let mockBusy = false;
let mockNodeHealth:
  | { url: string; ok: boolean; latencyMs: number | null; atMs: number }
  | undefined;
const mockGetIdentityId = jest.fn(async () => '3');
// Stands in for the stored key's fingerprint, which names the runtime identity.
const mockGetRuntimeUuid = jest.fn(
  async (accountId: string): Promise<string | undefined> => `fp-${accountId}`,
);
const mockUpdateXmrBirthday = jest.fn(async () => undefined);
const mockDeleteXmrDatabase = jest.fn(async (_network: string) => undefined);
const mockForgetStaleFirst = jest.fn<void, [string[] | undefined]>();
const mockOnlineRuntime = jest.fn(async () => runtime);
const mockLiveTip = jest.fn(async () => 3_767_827);
let mockCachedTip: number | undefined = 3_767_827;
jest.mock('./runtime', () => ({
  isXmrRuntimeBusy: () => mockBusy,
  forgetXmrStaleFirst: (accountIds?: string[]) =>
    mockForgetStaleFirst(accountIds),
  deleteXmrDatabase: (network: string) => mockDeleteXmrDatabase(network),
  getXmrRuntime: () => mockOnlineRuntime(),
  getXmrLocalRuntime: async () => runtime,
  getXmrIdentityId: () => mockGetIdentityId(),
  getXmrRuntimeUuid: ({ accountId }: { accountId: string }) =>
    mockGetRuntimeUuid(accountId),
  getXmrChainTip: () => mockLiveTip(),
  getXmrLastKnownChainTip: async () => mockCachedTip,
  getXmrNodeHealth: () => mockNodeHealth,
  readXmrStaleFirst: async <T>(p: {
    read: () => Promise<T>;
    fallback: T;
  }): Promise<T> => (mockBusy ? p.fallback : p.read()),
}));

const mockPublish = jest.fn(async () => undefined);
let mockHasAnyAccountState = true;

function memoryCache() {
  let saved: unknown = null;
  const entity = new SimpleDbEntityPrivacyChainCache();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return entity;
}
let privacyChainCache = memoryCache();
beforeEach(() => {
  privacyChainCache = memoryCache();
});

let mockNodeUrl = 'https://node.example:18081';

// The service derives or reads the stored view key; undefined means it can't
// yet (locked wallet, no cached password).
const mockEnsureViewingKey = jest.fn(
  async ({ accountId }: { accountId: string }): Promise<string | undefined> =>
    `key-${accountId}`,
);

const viewingKeys = async ({ accountId }: { accountId: string }) => ({
  primaryAddress: '4-primary',
  vkFp: `fp-${accountId}`,
  spendPublicKeyHex: 'synthetic-spend-public',
  viewPrivateKeyHex: 'synthetic-view-private',
});

function capability(intent: 'on' | 'off' = 'on', birthdayHeight?: number) {
  const vault = {
    networkId: 'xmr--0',
    getXmrNetwork: async () => 'mainnet',
    resolveXmrNodeUrl: async () => mockNodeUrl,
    getXmrViewingKeys: viewingKeys,
    backgroundApi: {
      servicePrivacyChain: {
        publishLocalWalletSyncProgress: mockPublish,
        onLocalWalletAccountsChanged: jest.fn(async () => undefined),
        ensureLocalWalletViewingKey: mockEnsureViewingKey,
      },
      simpleDb: {
        privacyChainCache,
        privacyChainState: {
          getAccountEpoch: async () => 'e1',
          getXmrAccountState: async () => ({
            intent,
            operation: undefined,
            birthdayHeight,
          }),
          listScanDataAccountIds: async () =>
            mockHasAnyAccountState ? ['acc'] : [],
          listXmrEnabledAccountIds: async () => ['acc'],
          listAccountIds: async () => ['acc'],
          beginXmrDisable: jest.fn(async () => undefined),
          completeXmrDisable: jest.fn(async () => undefined),
          updateXmrBirthday: mockUpdateXmrBirthday,
        },
      },
    },
  } as unknown as Vault;
  return buildXmrLocalWalletCapability(vault);
}

describe('xmr frozen balance', () => {
  it('says why each part cannot be spent yet', async () => {
    const balance = await capability().getAccountBalance({ accountId: 'acc' });
    const expected = [
      { reason: 'needsPassword', amountParsed: '0.5' },
      { reason: 'pendingSend', amountParsed: '0.3' },
      { reason: 'confirming', amountParsed: '0.2' },
    ];
    expect(balance?.frozen).toEqual(expected);
    expect(balance?.pools[0].frozen).toEqual(expected);
    expect(balance?.pools[0].hints).toEqual([]);
  });

  it('reports nothing at all while scanning is off', async () => {
    await expect(
      capability('off').getAccountBalance({ accountId: 'acc' }),
    ).resolves.toBeNull();
  });
});

describe('xmr sync progress before the first block', () => {
  afterEach(() => {
    peek = { scannedToHeight: null, ranges: [] };
  });

  // Enabled but not yet scanned: progress must still show numbers.
  it('reports the queued range start as 0% rather than nothing', async () => {
    peek = {
      scannedToHeight: null,
      ranges: [{ start: 3_000_000, end: 3_767_828 }],
    };
    const progress = await capability('on', 3_000_000).getSyncProgress({
      accountId: 'acc',
    });
    expect(progress?.backfillScannedHeight).toBe(3_000_000);
    expect(progress?.backfillTargetHeight).toBe(3_767_827);
    expect(progress?.backfillProgress).toBe(0);
    expect(progress?.isSyncing).toBe(true);
    expect(progress?.isBackfillComplete).toBe(false);
    // Nothing has actually been scanned, so the tip reading stays honest.
    expect(progress?.tipScannedHeight).toBeNull();
    expect(progress?.tipLag).toBeNull();
  });

  it('uses the real scanned height once there is one', async () => {
    peek = {
      scannedToHeight: 3_400_000,
      ranges: [{ start: 3_400_001, end: 3_767_828 }],
    };
    const progress = await capability('on', 3_000_000).getSyncProgress({
      accountId: 'acc',
    });
    expect(progress?.backfillScannedHeight).toBe(3_400_000);
    expect(progress?.tipScannedHeight).toBe(3_400_000);
    expect(progress?.backfillProgress).toBeGreaterThan(0.5);
  });

  // Resume stores the tip as the birthday while the runtime keeps the real one.
  it("measures from the runtime's birthday, not the stored one", async () => {
    peek = {
      scannedToHeight: 3_400_000,
      ranges: [{ start: 3_400_001, end: 3_767_828 }],
      birthdayHeight: 3_000_000,
    };
    const progress = await capability('on', 3_767_000).getSyncProgress({
      accountId: 'acc',
    });
    expect(progress?.birthdayHeight).toBe(3_000_000);
    expect(progress?.backfillProgress).toBeGreaterThan(0.5);
  });
});

describe('xmr syncGroup turns', () => {
  const realNow = Date.now;
  afterEach(() => {
    Date.now = realNow;
    runtime.syncStep.mockReset();
    runtime.syncStep.mockImplementation(async () =>
      JSON.stringify({ blocksScanned: 10, done: false, outputsFound: 0 }),
    );
    runtime.updateChainTip.mockClear();
    mockPublish.mockClear();
  });

  // A turn is small steps inside the watchdog budget, ending early once caught up.
  it('steps in small batches until caught up', async () => {
    runtime.syncStep
      .mockImplementationOnce(async () =>
        JSON.stringify({ blocksScanned: 10, done: false, outputsFound: 1 }),
      )
      .mockImplementationOnce(async () =>
        JSON.stringify({ blocksScanned: 4, done: true, outputsFound: 0 }),
      );
    const result = await capability().syncGroup({
      accountIds: ['acc'],
      chainTip: 3_767_827,
    });
    expect(runtime.updateChainTip).toHaveBeenCalledTimes(1);
    expect(runtime.syncStep).toHaveBeenCalledTimes(2);
    expect(runtime.syncStep.mock.calls[0][1]).toBe(
      String(XMR_SYNC_STEP_BLOCKS),
    );
    // Published once per step: new state, published state.
    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledWith({
      networkId: 'xmr--0',
      accountIds: ['acc'],
    });
    expect(result).toMatchObject({
      synced: true,
      stateChanged: true,
      backfillRemaining: false,
    });
  });

  // A page turned away by a busy runtime asks the scan for a balance; the
  // scan saves one after its step and the page's next read gets it.
  it('saves a balance mid-turn only when a page asked for one', async () => {
    const { balance } = runtime;
    const balanceReads = jest.fn(balance);
    runtime.balance = balanceReads;
    try {
      runtime.syncStep.mockImplementationOnce(async () =>
        JSON.stringify({ blocksScanned: 4, done: true, outputsFound: 1 }),
      );
      await capability().syncGroup({
        accountIds: ['acc'],
        chainTip: 3_767_827,
      });
      // Nobody asked: the scan read nothing extra.
      expect(balanceReads).not.toHaveBeenCalled();

      mockBusy = true;
      await expect(
        capability().getAccountBalance({ accountId: 'acc' }),
      ).resolves.toBeNull();
      mockBusy = false;
      runtime.syncStep.mockImplementationOnce(async () =>
        JSON.stringify({ blocksScanned: 4, done: true, outputsFound: 0 }),
      );
      await capability().syncGroup({
        accountIds: ['acc'],
        chainTip: 3_767_827,
      });
      expect(balanceReads).toHaveBeenCalledTimes(1);

      mockBusy = true;
      await expect(
        capability().getAccountBalance({ accountId: 'acc' }),
      ).resolves.toMatchObject({
        total: '2000000000000',
        balanceStatus: 'partial',
      });
    } finally {
      mockBusy = false;
      runtime.balance = balance;
    }
  });

  it('keeps scanning when the asked-for balance cannot be read', async () => {
    const { balance } = runtime;
    runtime.balance = async () => {
      throw new OneKeyLocalError('DATABASE_ERROR');
    };
    try {
      mockBusy = true;
      await capability().getAccountBalance({ accountId: 'acc' });
      mockBusy = false;
      runtime.syncStep.mockImplementationOnce(async () =>
        JSON.stringify({ blocksScanned: 4, done: true, outputsFound: 1 }),
      );
      await expect(
        capability().syncGroup({ accountIds: ['acc'], chainTip: 3_767_827 }),
      ).resolves.toMatchObject({ synced: true, stateChanged: true });
    } finally {
      mockBusy = false;
      runtime.balance = balance;
    }
  });

  // Without the rollback every later step fails on the same orphaned block.
  it('rolls back and keeps scanning when the chain reorganised', async () => {
    runtime.syncStep
      .mockImplementationOnce(async () => {
        throw new OneKeyLocalError(
          JSON.stringify({
            code: 'REORG_DETECTED',
            params: { atHeight: 3_767_800, suggestedRewindHeight: 3_767_790 },
          }),
        );
      })
      .mockImplementationOnce(async () =>
        JSON.stringify({ blocksScanned: 10, done: true, outputsFound: 0 }),
      );
    const result = await capability().syncGroup({
      accountIds: ['acc'],
      chainTip: 3_767_827,
    });
    expect(runtime.rewindTo).toHaveBeenCalledWith('3', '3767790', '3767827');
    expect(runtime.syncStep).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ synced: true, stateChanged: true });
  });

  it('stops at the turn budget and reports work remaining', async () => {
    let now = 1_000_000;
    Date.now = () => now;
    runtime.syncStep.mockImplementation(async () => {
      // 12 s steps in a 30 s watchdog: two fit, a third would end at 36 s.
      now += 12_000;
      return JSON.stringify({
        blocksScanned: 10,
        done: false,
        outputsFound: 0,
      });
    });
    const result = await capability().syncGroup({
      accountIds: ['acc'],
      chainTip: 3_767_827,
    });
    expect(runtime.syncStep).toHaveBeenCalledTimes(2);
    expect(result.backfillRemaining).toBe(true);
  });
});

describe('xmr sync policy', () => {
  // runBoundedSyncTurn always runs the first step, so the estimate must fit.
  it('declares a step estimate that fits inside the turn budget', () => {
    const { syncPolicy } = capability();
    expect(syncPolicy.turn).toBeDefined();
    expect(syncPolicy.turn?.expectedStepMs).toBeLessThan(
      syncPolicy.turn?.budgetMs ?? 0,
    );
    expect(syncPolicy.turn?.stepBlocks).toBeGreaterThan(0);
  });

  // The watchdog only ends a stuck turn; the turn budget prevents starvation.
  it('lets a slow step finish instead of treating it as stuck', () => {
    const { syncPolicy } = capability();
    expect(syncPolicy.maxSyncDurationMs).toBeGreaterThan(
      (syncPolicy.turn?.budgetMs ?? 0) * 10,
    );
  });
});

describe('xmr UI reads while a scan step is in flight', () => {
  afterEach(() => {
    mockBusy = false;
  });

  it('answers balance without waiting: nothing seen yet means nothing', async () => {
    mockBusy = true;
    await expect(
      capability().getAccountBalance({ accountId: 'acc' }),
    ).resolves.toBeNull();
  });

  // Seen before on this device: shown, but not as current.
  it('answers balance with the saved one, marked not current', async () => {
    const live = await capability().getAccountBalance({ accountId: 'acc' });
    mockBusy = true;
    await expect(
      capability().getAccountBalance({ accountId: 'acc' }),
    ).resolves.toEqual({ ...live, balanceStatus: 'partial' });
  });

  it('answers progress with an honest syncing placeholder', async () => {
    mockBusy = true;
    const progress = await capability('on', 3_000_000).getSyncProgress({
      accountId: 'acc',
    });
    expect(progress).toMatchObject({
      birthdayHeight: 3_000_000,
      isSyncing: true,
      isBackfillComplete: false,
      backfillScannedHeight: null,
    });
  });
});

describe('xmr local sync data size', () => {
  afterEach(() => {
    mockHasAnyAccountState = true;
    runtime.diagDatabase.mockClear();
  });

  it('reports the database size the runtime measures', async () => {
    await expect(capability().getStorageUsage?.()).resolves.toEqual({
      bytes: 4_096_000,
    });
  });

  // Opening the runtime creates its database; a device that never scanned
  // must not get one just because the settings page asked how big it is.
  it('reports nothing stored without opening the runtime when never enabled', async () => {
    mockHasAnyAccountState = false;
    await expect(capability().getStorageUsage?.()).resolves.toEqual({
      bytes: 0,
    });
    expect(runtime.diagDatabase).not.toHaveBeenCalled();
  });
});

// rewindTo(H) keeps block H, so a rescan "from H" must rewind to H - 1.
describe('xmr rescans include their starting block', () => {
  beforeEach(() => runtime.rewindTo.mockClear());

  // The service rotates the epochs first (lifecycle executor); the
  // primitive only rewinds.
  it('rescans the birthday block on a cache reset', async () => {
    await capability('on', 3_700_000).rewindAccount({ accountId: 'acc' });
    expect(runtime.rewindTo).toHaveBeenCalledWith('3', '3699999', '3767827');
    // A step in flight must not answer with the pre-rewind values.
    expect(mockForgetStaleFirst).toHaveBeenCalledWith(['acc']);
  });

  it('rescans the chosen block on a rescan from a height', async () => {
    await capability().rescan({
      accountId: 'acc',
      from: { type: 'height', height: 3_700_000 },
    });
    expect(runtime.rewindTo).toHaveBeenCalledWith('3', '3699999', '3767827');
    // A step in flight must not answer with the pre-rewind values.
    expect(mockForgetStaleFirst).toHaveBeenCalledWith(['acc']);
  });

  // An earlier start widens what the account covers.
  it('moves the birthday back to an earlier rescan start', async () => {
    mockUpdateXmrBirthday.mockClear();
    await capability('on', 3_700_000).rescan({
      accountId: 'acc',
      from: { type: 'height', height: 3_600_000 },
    });
    expect(mockUpdateXmrBirthday).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc', birthdayHeight: 3_600_000 }),
    );
  });

  // The runtime keeps everything scanned before a later start; storing the
  // later height would drop those funds the next time the database is rebuilt.
  it('keeps the earlier birthday on a later rescan start', async () => {
    mockUpdateXmrBirthday.mockClear();
    await capability('on', 3_600_000).rescan({
      accountId: 'acc',
      from: { type: 'height', height: 3_700_000 },
    });
    expect(mockUpdateXmrBirthday).not.toHaveBeenCalled();
  });
});

// The repair path clears history and progress of every alias.
it('xmr reports the account itself as its only alias', async () => {
  await expect(
    capability().getAccountAliases({ accountId: 'acc' }),
  ).resolves.toEqual(['acc']);
});

it.each(['spendsDetected', 'sendsRestored'] as const)(
  'xmr reports %s as a state change',
  async (field) => {
    runtime.syncStep.mockImplementationOnce(async () =>
      JSON.stringify({
        blocksScanned: 10,
        done: true,
        outputsFound: 0,
        [field]: 1,
      }),
    );
    const result = await capability().syncGroup({
      accountIds: ['acc'],
      chainTip: 3_767_827,
    });
    expect(result).toMatchObject({ stateChanged: true });
  },
);

// A database the runtime refuses to open (newer schema, corruption) must still
// be recoverable from Settings, without a password.
describe('xmr storage reset', () => {
  // B4: a paused account keeps its identity, so resuming it still finds one.
  it('re-registers every account holding scan data, paused ones included, without the node', async () => {
    runtime.addAccount.mockClear();
    mockOnlineRuntime.mockClear();
    mockLiveTip.mockClear();
    mockDeleteXmrDatabase.mockClear();
    const states: Record<string, { intent: 'on' | 'off' }> = {
      'acc-1': { intent: 'on' },
      'acc-2': { intent: 'on' },
      'paused': { intent: 'off' },
    };
    const cap = buildXmrLocalWalletCapability({
      networkId: 'xmr--0',
      getXmrNetwork: async () => 'mainnet',
      getXmrViewingKeys: viewingKeys,
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            listXmrEnabledAccountIds: async () => ['acc-1', 'acc-2'],
            listScanDataAccountIds: async () => ['acc-1', 'acc-2', 'paused'],
            getXmrAccountState: async ({
              accountId,
            }: {
              accountId: string;
            }) => ({
              ...states[accountId],
              birthdayHeight: 3_600_000,
            }),
          },
        },
      },
    } as unknown as Vault);
    await cap.resetStorage?.();

    expect(mockDeleteXmrDatabase).toHaveBeenCalledWith('mainnet');
    expect(mockDeleteXmrDatabase.mock.invocationCallOrder[0]).toBeLessThan(
      runtime.addAccount.mock.invocationCallOrder[0],
    );
    expect(runtime.addAccount.mock.calls).toEqual(
      ['acc-1', 'acc-2', 'paused'].map((accountId) => [
        `fp-${accountId}`,
        'synthetic-spend-public',
        'synthetic-view-private',
        '3600000',
      ]),
    );
    expect(mockOnlineRuntime).not.toHaveBeenCalled();
    expect(mockLiveTip).not.toHaveBeenCalled();
  });
});

// The settings page deletes an enabled account by turning it off first; a
// sync that still lists it must not register it again.
describe('xmr delete after turning the account off', () => {
  it('leaves nothing for a later sync to register', async () => {
    let state: Record<string, unknown> = {
      intent: 'on',
      birthdayHeight: 3_600_000,
    };
    const getXmrViewingKeys = jest.fn(viewingKeys);
    // The executor removed the key with the data; nothing can derive it in
    // the background without a cached password.
    const ensureLocalWalletViewingKey = jest.fn(async () => undefined);
    const cap = buildXmrLocalWalletCapability({
      networkId: 'xmr--0',
      getXmrNetwork: async () => 'mainnet',
      getXmrViewingKeys,
      backgroundApi: {
        servicePrivacyChain: {
          publishLocalWalletSyncProgress: mockPublish,
          onLocalWalletAccountsChanged: jest.fn(async () => undefined),
          ensureLocalWalletViewingKey,
        },
        simpleDb: {
          privacyChainCache,
          privacyChainState: {
            getAccountEpoch: async () => 'e1',
            getXmrAccountState: async () => state,
            beginXmrDisable: async () => {
              state = { ...state, operation: { type: 'disable' } };
            },
            completeXmrDisable: async () => {
              state = { ...state, intent: 'off', operation: undefined };
            },
            listAccountIds: async () => ['acc'],
            listScanDataAccountIds: async () => ['acc'],
          },
        },
      },
    } as unknown as Vault);
    runtime.addAccount.mockClear();
    runtime.removeAccount.mockClear();
    runtime.syncStep.mockClear();

    await cap.disableAccount({ accountId: 'acc' });
    await expect(
      cap.deleteRuntimeAccount({ accountId: 'acc' }),
    ).resolves.toEqual({ orphaned: false });
    expect(runtime.removeAccount).toHaveBeenCalledWith('fp-acc');

    // The executor removed the key with the data. A sync whose account list
    // predates the delete must not derive it again for an account now off.
    mockGetRuntimeUuid.mockImplementation(async () => undefined);
    try {
      await expect(
        cap.syncGroup({ accountIds: ['acc'], chainTip: 3_767_827 }),
      ).resolves.toEqual({ synced: false });
    } finally {
      mockGetRuntimeUuid.mockImplementation(
        async (accountId: string) => `fp-${accountId}`,
      );
    }
    expect(ensureLocalWalletViewingKey).not.toHaveBeenCalled();
    expect(getXmrViewingKeys).not.toHaveBeenCalled();
    expect(runtime.addAccount).not.toHaveBeenCalled();
    expect(runtime.syncStep).not.toHaveBeenCalled();
  });
});

// P3: one account whose key can't be read must not stall the whole group.
describe('xmr sync skips an account without its view key', () => {
  beforeEach(() => {
    // No stored key: the sync has to derive one.
    mockGetRuntimeUuid.mockImplementation(async () => undefined);
  });

  afterEach(() => {
    mockEnsureViewingKey.mockImplementation(
      async ({ accountId }) => `key-${accountId}`,
    );
    mockGetRuntimeUuid.mockImplementation(
      async (accountId: string) => `fp-${accountId}`,
    );
  });

  it('steps the others and skips the locked one', async () => {
    mockEnsureViewingKey.mockImplementation(async ({ accountId }) =>
      accountId === 'locked' ? undefined : `key-${accountId}`,
    );
    runtime.syncStep.mockClear();
    runtime.syncStep.mockImplementationOnce(async () =>
      JSON.stringify({ blocksScanned: 4, done: true, outputsFound: 0 }),
    );
    const result = await capability().syncGroup({
      accountIds: ['locked', 'acc'],
      chainTip: 3_767_827,
    });
    expect(runtime.syncStep).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ synced: true, backfillRemaining: false });
  });

  it('reports no turn when every account is waiting for its key', async () => {
    mockEnsureViewingKey.mockImplementation(async () => {
      throw new OneKeyLocalError('derivation failed');
    });
    runtime.syncStep.mockClear();
    await expect(
      capability().syncGroup({ accountIds: ['acc'], chainTip: 3_767_827 }),
    ).resolves.toEqual({ synced: false });
    expect(runtime.syncStep).not.toHaveBeenCalled();
  });
});

// A Resync that could not reach the node leaves the account enabled but
// unknown to the runtime; the next sync registers it from its saved birthday.
describe('xmr sync registers an enabled account the runtime lost', () => {
  it('adds it back from the saved birthday before scanning', async () => {
    mockGetIdentityId.mockRejectedValueOnce(new Error('not registered'));
    runtime.addAccount.mockClear();
    runtime.syncStep.mockResolvedValueOnce(
      JSON.stringify({ blocksScanned: 10, done: true, outputsFound: 0 }),
    );
    const cap = buildXmrLocalWalletCapability({
      networkId: 'xmr--0',
      getXmrViewingKeys: async () => ({
        primaryAddress: '4-primary',
        vkFp: 'fp-acc',
        spendPublicKeyHex: 'spend-pub',
        viewPrivateKeyHex: 'view-priv',
      }),
      backgroundApi: {
        servicePrivacyChain: {
          publishLocalWalletSyncProgress: mockPublish,
          ensureLocalWalletViewingKey: mockEnsureViewingKey,
        },
        simpleDb: {
          privacyChainState: {
            getXmrAccountState: async () => ({
              intent: 'on',
              birthdayHeight: 3_700_000,
            }),
          },
        },
      },
    } as unknown as Vault);

    await cap.syncGroup({ accountIds: ['acc'], chainTip: 3_767_827 });

    expect(runtime.addAccount).toHaveBeenCalledWith(
      'fp-acc',
      'spend-pub',
      'view-priv',
      '3700000',
    );
  });
});

describe('xmr user lifecycle operations do not depend on pending history', () => {
  afterEach(() => {
    runtime.history.mockReset();
    runtime.history.mockResolvedValue(JSON.stringify({ items: [], total: 0 }));
    jest.restoreAllMocks();
  });

  it.each(['pending', 'unreadable'] as const)(
    'allows all local lifecycle operations with %s history',
    async (historyState) => {
      if (historyState === 'pending') {
        runtime.history.mockResolvedValue(
          JSON.stringify({
            items: [
              { txid: 'aa', height: null, direction: 'out', failed: false },
            ],
            total: 1,
          }),
        );
      } else {
        runtime.history.mockRejectedValue(new Error('history unavailable'));
      }
      runtime.history.mockClear();
      runtime.rewindTo.mockClear();
      runtime.removeAccount.mockClear();
      mockDeleteXmrDatabase.mockClear();

      const cap = capability('on', 3_600_000);
      const enable = jest
        .spyOn(cap, 'enableAccount')
        .mockResolvedValue(undefined);
      await cap.disableAccount({ accountId: 'acc' });
      await cap.deleteRuntimeAccount({ accountId: 'acc' });
      await cap.rewindAccount({ accountId: 'acc' });
      await expect(
        cap.rescan({
          accountId: 'acc',
          from: { type: 'height', height: 3_700_000 },
        }),
      ).resolves.toEqual({ fromHeight: 3_700_000 });
      await cap.resetStorage?.();

      expect(runtime.history).not.toHaveBeenCalled();
      expect(runtime.rewindTo).toHaveBeenCalledTimes(2);
      expect(runtime.removeAccount).toHaveBeenCalledTimes(1);
      expect(mockDeleteXmrDatabase).toHaveBeenCalledWith('mainnet');
      expect(enable).not.toHaveBeenCalled();
    },
  );

  it('propagates a real database deletion failure', async () => {
    const error = new Error('storage deletion failed');
    mockDeleteXmrDatabase.mockRejectedValueOnce(error);
    const cap = capability('on', 3_600_000);
    const enable = jest
      .spyOn(cap, 'enableAccount')
      .mockResolvedValue(undefined);

    await expect(cap.resetStorage?.()).rejects.toBe(error);
    expect(enable).not.toHaveBeenCalled();
  });
});

// The runtime half of deleting an account's data; keys, journals and state
// are the lifecycle executor's (ServicePrivacyChain).
describe('xmr runtime identity removal', () => {
  beforeEach(() => {
    runtime.removeAccount.mockClear();
  });
  afterEach(() => {
    mockGetRuntimeUuid.mockImplementation(
      async (accountId) => `fp-${accountId}`,
    );
  });

  function capabilityWithHolders(holders: string[] | undefined) {
    return buildXmrLocalWalletCapability({
      networkId: 'xmr--0',
      getXmrNetwork: async () => 'mainnet',
      backgroundApi: {
        simpleDb: {
          privacyChainState: { listScanDataAccountIds: async () => holders },
        },
      },
    } as unknown as Vault);
  }

  it('removes a lone identity', async () => {
    await expect(
      capabilityWithHolders(['acc']).deleteRuntimeAccount({ accountId: 'acc' }),
    ).resolves.toEqual({ orphaned: false });
    expect(runtime.removeAccount).toHaveBeenCalledWith('fp-acc');
  });

  it('keeps an identity a live alias holds', async () => {
    mockGetRuntimeUuid.mockImplementation(async () => 'fp-shared');
    await expect(
      capabilityWithHolders(['acc', 'alias']).deleteRuntimeAccount({
        accountId: 'acc',
      }),
    ).resolves.toEqual({ orphaned: false });
    expect(runtime.removeAccount).not.toHaveBeenCalled();
  });

  // Nothing names the identity any more: orphan cleanup must settle it.
  it('reports a possible orphan when its own key is gone', async () => {
    mockGetRuntimeUuid.mockImplementation(async () => undefined);
    await expect(
      capabilityWithHolders(['acc']).deleteRuntimeAccount({ accountId: 'acc' }),
    ).resolves.toEqual({ orphaned: true });
    expect(runtime.removeAccount).not.toHaveBeenCalled();
  });

  it("reports a possible orphan when another holder's key is unreadable", async () => {
    mockGetRuntimeUuid.mockImplementation(async (accountId) =>
      accountId === 'acc' ? 'fp-acc' : undefined,
    );
    await expect(
      capabilityWithHolders(['acc', 'other']).deleteRuntimeAccount({
        accountId: 'acc',
      }),
    ).resolves.toEqual({ orphaned: true });
    expect(runtime.removeAccount).not.toHaveBeenCalled();
  });
});

// Nothing read (no state, or Travel Mode) is not "no other holder": an
// identity another account may share stays for orphan cleanup to judge.
it('xmr keeps the runtime identity when the state cannot say who holds it', async () => {
  runtime.removeAccount.mockClear();
  const cap = buildXmrLocalWalletCapability({
    networkId: 'xmr--0',
    getXmrNetwork: async () => 'mainnet',
    backgroundApi: {
      simpleDb: {
        privacyChainState: {
          listScanDataAccountIds: async () => undefined,
        },
      },
    },
  } as unknown as Vault);

  await expect(cap.deleteRuntimeAccount({ accountId: 'acc' })).resolves.toEqual(
    { orphaned: true },
  );
  expect(runtime.removeAccount).not.toHaveBeenCalled();
});

describe('xmr local management while offline', () => {
  afterEach(() => {
    mockOnlineRuntime.mockReset().mockResolvedValue(runtime);
    mockLiveTip.mockReset().mockResolvedValue(3_767_827);
    mockCachedTip = 3_767_827;
    peek = { scannedToHeight: null, ranges: [] };
  });

  it('deletes and rewinds local data without connecting or querying the node', async () => {
    mockOnlineRuntime.mockClear();
    mockLiveTip.mockClear();
    mockOnlineRuntime.mockRejectedValue(new OneKeyLocalError('offline'));
    mockLiveTip.mockRejectedValue(new OneKeyLocalError('offline'));
    runtime.rewindTo.mockClear();
    const cap = capability('on', 3_600_000);

    await cap.deleteRuntimeAccount({ accountId: 'acc' });
    await cap.rewindAccount({ accountId: 'acc' });
    await expect(
      cap.rescan({
        accountId: 'acc',
        from: { type: 'height', height: 3_700_000 },
      }),
    ).resolves.toEqual({ fromHeight: 3_700_000 });

    expect(mockOnlineRuntime).not.toHaveBeenCalled();
    expect(mockLiveTip).not.toHaveBeenCalled();
    expect(runtime.rewindTo).toHaveBeenCalledWith('3', '3699999', '3767827');
  });

  it('uses observed local scan ranges when no cached tip exists', async () => {
    mockOnlineRuntime.mockClear();
    mockLiveTip.mockClear();
    mockOnlineRuntime.mockRejectedValue(new OneKeyLocalError('offline'));
    mockCachedTip = undefined;
    peek = {
      scannedToHeight: 3_650_000,
      ranges: [{ start: 3_650_001, end: 3_700_001 }],
    };
    runtime.rewindTo.mockClear();

    await capability('on', 3_600_000).rewindAccount({ accountId: 'acc' });

    expect(runtime.rewindTo).toHaveBeenCalledWith('3', '3599999', '3700000');
    expect(mockOnlineRuntime).not.toHaveBeenCalled();
  });
});

describe('xmr chain tip for the next cold start', () => {
  it('saves the tip the scheduler fetches', async () => {
    await expect(capability().getChainTip()).resolves.toBe(3_767_827);
    await expect(
      privacyChainCache.getChainTip({ networkId: 'xmr--0' }),
    ).resolves.toBe(3_767_827);
  });
});

describe('xmr sync endpoint', () => {
  afterEach(() => {
    mockNodeHealth = undefined;
    mockNodeUrl = 'https://node.example:18081';
  });

  it('reports the node in use and the built-in default', async () => {
    mockNodeUrl = XMR_BUILT_IN_NODE_URLS[0];
    await expect(capability().getSyncEndpoint?.()).resolves.toEqual({
      url: XMR_BUILT_IN_NODE_URLS[0],
      defaultUrl: XMR_BUILT_IN_NODE_URLS[0],
      health: undefined,
    });
  });

  it('shows the last sample taken from that node', async () => {
    mockNodeHealth = {
      url: mockNodeUrl,
      ok: true,
      latencyMs: 120,
      atMs: 5000,
    };
    const endpoint = await capability().getSyncEndpoint?.();
    expect(endpoint?.url).toBe('https://node.example:18081');
    expect(endpoint?.health).toEqual({ ok: true, latencyMs: 120, atMs: 5000 });
  });

  // After a switch the sample still describes the previous node.
  it('hides a sample taken from a different node', async () => {
    mockNodeHealth = {
      url: 'https://old.example:18081',
      ok: false,
      latencyMs: null,
      atMs: 5000,
    };
    const endpoint = await capability().getSyncEndpoint?.();
    expect(endpoint?.health).toBeUndefined();
  });
});

// Runtime only: the executor removes the network's host records.
describe('xmr app reset wipe', () => {
  it('deletes the database and nothing else', async () => {
    mockDeleteXmrDatabase.mockClear();
    const cap = buildXmrLocalWalletCapability({
      networkId: 'xmr--0',
      getXmrNetwork: async () => 'mainnet',
      backgroundApi: { simpleDb: {} },
    } as unknown as Vault);

    await cap.dropLocalData?.();

    expect(mockDeleteXmrDatabase).toHaveBeenCalledWith('mainnet');
  });
});

// P2-1: an account removed without its key may have left an identity.
describe('xmr local data presence', () => {
  function capabilityWith(accountIds: string[], orphans: boolean) {
    return buildXmrLocalWalletCapability({
      networkId: 'xmr--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            listAccountIds: async () => accountIds,
            hasRuntimeOrphans: async () => orphans,
          },
        },
      },
    } as unknown as Vault);
  }

  it('holds data while a record exists', async () => {
    await expect(capabilityWith(['acc'], false).hasLocalData?.()).resolves.toBe(
      true,
    );
  });

  it('holds data while the network may hold orphans', async () => {
    await expect(capabilityWith([], true).hasLocalData?.()).resolves.toBe(true);
  });

  it('holds nothing otherwise', async () => {
    await expect(capabilityWith([], false).hasLocalData?.()).resolves.toBe(
      false,
    );
  });
});
