import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { withMemoryStorage as memoryEntity } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainKeys } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';
import {
  getLocalWalletViewingKey,
  saveLocalWalletViewingKey,
} from '../../localWallet/viewingKeyStore';

import { buildXmrLocalWalletCapability } from './localWallet';

import type Vault from './Vault';

// The fake follows monero-runtime add_identity: idempotent by uuid; the same uuid with
// other keys starts clean; the same keys under a new uuid are renamed in place.

const NETWORK_ID = 'xmr--0';
const TIP = 3_768_162;

type IFakeIdentity = {
  id: number;
  uuid: string;
  primaryAddress: string;
  birthdayHeight: number;
  sends: string[];
};

class FakeXmrRuntime {
  identities: IFakeIdentity[] = [];

  nextId = 1;

  steppedIds: string[] = [];

  private row(identity: IFakeIdentity) {
    return JSON.stringify({
      accountId: identity.id,
      uuid: identity.uuid,
      primaryAddress: identity.primaryAddress,
      birthdayHeight: identity.birthdayHeight,
      scanResetSupported: true,
    });
  }

  addAccount = jest.fn(
    async (uuid: string, spend: string, view: string, birthday: string) => {
      const primaryAddress = `4${spend}${view}`;
      const byUuid = this.identities.find((item) => item.uuid === uuid);
      if (byUuid) {
        if (byUuid.primaryAddress !== primaryAddress)
          throw new OneKeyLocalError('identityKeyMismatch');
        byUuid.birthdayHeight = Number(birthday);
        return this.row(byUuid);
      }
      const byAddress = this.identities.find(
        (item) => item.primaryAddress === primaryAddress,
      );
      if (byAddress) {
        byAddress.uuid = uuid;
        byAddress.birthdayHeight = Number(birthday);
        return this.row(byAddress);
      }
      const created: IFakeIdentity = {
        id: this.nextId,
        uuid,
        primaryAddress,
        birthdayHeight: Number(birthday),
        sends: [],
      };
      this.nextId += 1;
      this.identities.push(created);
      return this.row(created);
    },
  );

  listAccounts = jest.fn(async () =>
    JSON.stringify({
      items: this.identities.map((item) => ({
        accountId: item.id,
        uuid: item.uuid,
        primaryAddress: item.primaryAddress,
      })),
    }),
  );

  removeAccount = jest.fn(async (uuid: string) => {
    const before = this.identities.length;
    this.identities = this.identities.filter((item) => item.uuid !== uuid);
    return JSON.stringify({ removed: this.identities.length < before });
  });

  updateChainTip = jest.fn(async () => '{}');
  balance = jest.fn(async () =>
    JSON.stringify({
      totalAtomic: '1000000000000',
      unlockedAtomic: '1000000000000',
      unverifiableAtomic: '0',
      pendingChangeAtomic: '0',
    }),
  );

  rewindTo = jest.fn(async (id: string, height: string, _tip: string) => {
    const identity = this.identities.find((item) => String(item.id) === id);
    if (identity) {
      identity.birthdayHeight = Math.min(
        identity.birthdayHeight,
        Number(height) + 1,
      );
    }
    return '{}';
  });

  syncPeek = jest.fn(async (id: string) =>
    JSON.stringify({
      scannedToHeight: 3_700_000,
      ranges: [],
      birthdayHeight: this.identities.find((item) => String(item.id) === id)
        ?.birthdayHeight,
    }),
  );

  syncStep = jest.fn(async (id: string) => {
    this.steppedIds.push(id);
    return JSON.stringify({ blocksScanned: 10, done: true, outputsFound: 0 });
  });
}

let mockRuntime = new FakeXmrRuntime();
let mockBusy = false;

jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime', () => ({
  hasXmrRuntimeApiLoader: () => true,
  getXmrRuntimeApi: async () => mockRuntime,
  readXmrRuntimeError: jest.requireActual(
    '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime',
  ).readXmrRuntimeError,
}));
jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/install', () => ({
  installXmrCarrier: () => undefined,
}));
// The real lookup (account -> stored key -> vkFp -> runtime row); only session and node are replaced.
jest.mock('./runtime', () => ({
  ...jest.requireActual<typeof import('./runtime')>('./runtime'),
  getXmrRuntime: async () => mockRuntime,
  getXmrLocalRuntime: async () => mockRuntime,
  getXmrChainTip: async () => TIP,
  getXmrLastKnownChainTip: async () => TIP,
  isXmrRuntimeBusy: () => mockBusy,
}));

type IScanStateKind = 'on' | 'paused' | 'enabling' | 'deleted-data';

async function seedScanState(
  xmr: SimpleDbEntityPrivacyChainState,
  accountId: string,
  kind: IScanStateKind,
  birthdayHeight = 10,
) {
  await xmr.beginXmrEnable({
    networkId: NETWORK_ID,
    accountId,
    birthdayHeight,
  });
  if (kind === 'enabling') return;
  await xmr.completeXmrEnable({ accountId });
  if (kind === 'paused') {
    await xmr.beginXmrDisable({ accountId, resumeFromHeight: 10 });
    await xmr.completeXmrDisable({ accountId });
  }
  if (kind === 'deleted-data') {
    await xmr.clearAccountScanData({ accountId });
  }
}

function createHarness() {
  const xmr = memoryEntity(new SimpleDbEntityPrivacyChainState());
  const privacyChainKeys = memoryEntity(new SimpleDbEntityPrivacyChainKeys());
  const backgroundApi = {
    servicePrivacyChain: {
      publishLocalWalletSyncProgress: jest.fn(async () => undefined),
      onLocalWalletAccountsChanged: jest.fn(async () => undefined),
      ensureLocalWalletViewingKey: async ({
        accountId,
      }: {
        accountId: string;
      }) =>
        (
          await getLocalWalletViewingKey({
            backgroundApi: backgroundApi as never,
            networkId: NETWORK_ID,
            accountId,
          })
        )?.value,
    },
    simpleDb: {
      privacyChainState: xmr,
      privacyChainKeys,
      privacyChainCache: memoryEntity(new SimpleDbEntityPrivacyChainCache()),
    },
  };
  const vault = {
    networkId: NETWORK_ID,
    backgroundApi,
    getXmrNetwork: async () => 'mainnet',
    resolveXmrNodeUrl: async () => 'https://node.example:18081',
    getXmrViewingKeys: async ({ accountId }: { accountId: string }) => {
      const key = await getLocalWalletViewingKey({
        backgroundApi: backgroundApi as never,
        networkId: NETWORK_ID,
        accountId,
      });
      if (!key) throw new OneKeyLocalError('viewing key unavailable');
      const [spendPublicKeyHex, viewPrivateKeyHex] = key.value.split(':');
      return {
        primaryAddress: `4${spendPublicKeyHex}${viewPrivateKeyHex}`,
        vkFp: key.vkFp,
        spendPublicKeyHex,
        viewPrivateKeyHex,
      };
    },
  } as unknown as Vault;
  const saveKey = (accountId: string, value: string) =>
    saveLocalWalletViewingKey({
      backgroundApi: backgroundApi as never,
      networkId: NETWORK_ID,
      accountId,
      value,
    });
  return {
    capability: buildXmrLocalWalletCapability(vault),
    xmr,
    saveKey,
    backgroundApi,
  };
}

const SHARED_KEY = 'aa:bb';
const SHARED_FP = getViewingKeyFingerprint({
  networkId: NETWORK_ID,
  viewingKey: SHARED_KEY,
});
const ALIAS_A = 'hd-1--0';
const ALIAS_B = 'hd-2--0';

beforeEach(() => {
  mockRuntime = new FakeXmrRuntime();
  mockBusy = false;
});

describe('xmr runtime identity named by viewing key', () => {
  it('gives two accounts with one view key a single identity', async () => {
    const { capability, saveKey } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, SHARED_KEY);

    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_600_000,
    });
    await capability.enableAccount({
      accountId: ALIAS_B,
      birthdayHeight: 3_600_000,
    });
    expect(mockRuntime.addAccount).not.toHaveBeenCalled();

    const { accounts } = await capability.listAccounts();
    expect(accounts.map((item) => item.accountRuntimeKey)).toEqual([
      SHARED_FP,
      SHARED_FP,
    ]);
    await expect(
      capability.getAccountAliases({ accountId: ALIAS_A }),
    ).resolves.toEqual([ALIAS_A, ALIAS_B]);
    await capability.syncGroup({
      accountIds: [ALIAS_A, ALIAS_B],
      chainTip: TIP,
    });
    expect(mockRuntime.addAccount.mock.calls.map(([uuid]) => uuid)).toEqual([
      SHARED_FP,
    ]);
    expect(mockRuntime.identities).toHaveLength(1);
    expect(mockRuntime.identities[0].uuid).toBe(SHARED_FP);
    expect(mockRuntime.steppedIds).toEqual(['1']);
  });

  it('keeps the shared identity while another alias still uses it', async () => {
    const { capability, saveKey, xmr } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, SHARED_KEY);
    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_600_000,
    });
    await capability.enableAccount({
      accountId: ALIAS_B,
      birthdayHeight: 3_600_000,
    });
    await capability.syncGroup({
      accountIds: [ALIAS_A, ALIAS_B],
      chainTip: TIP,
    });

    await expect(
      capability.deleteRuntimeAccount({ accountId: ALIAS_A }),
    ).resolves.toEqual({ orphaned: false });
    expect(mockRuntime.removeAccount).not.toHaveBeenCalled();
    expect(mockRuntime.identities).toHaveLength(1);
    await xmr.clearAccountScanData({ accountId: ALIAS_A });

    await capability.deleteRuntimeAccount({ accountId: ALIAS_B });
    expect(mockRuntime.removeAccount).toHaveBeenCalledWith(SHARED_FP);
    expect(mockRuntime.identities).toHaveLength(0);
  });

  it('moves an existing shared identity earlier when a freshly enabled alias needs older history', async () => {
    const { capability, saveKey, xmr } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, SHARED_KEY);
    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_600_000,
    });
    await capability.syncGroup({ accountIds: [ALIAS_A], chainTip: TIP });
    mockRuntime.identities[0].sends.push('pending-outgoing');
    const oldEpoch = await xmr.getAccountEpoch({ accountId: ALIAS_A });

    await capability.enableAccount({
      accountId: ALIAS_B,
      birthdayHeight: 3_000_000,
    });
    expect(mockRuntime.rewindTo).not.toHaveBeenCalled();
    await expect(
      capability.syncGroup({ accountIds: [ALIAS_A, ALIAS_B], chainTip: TIP }),
    ).resolves.toMatchObject({ backfillRemaining: true, stateChanged: true });

    expect(mockRuntime.rewindTo).not.toHaveBeenCalled();
    expect(mockRuntime.addAccount).toHaveBeenLastCalledWith(
      SHARED_FP,
      'aa',
      'bb',
      '3000000',
    );
    expect(mockRuntime.identities).toEqual([
      {
        id: 1,
        uuid: SHARED_FP,
        primaryAddress: '4aabb',
        birthdayHeight: 3_000_000,
        sends: ['pending-outgoing'],
      },
    ]);
    expect(await xmr.getAccountEpoch({ accountId: ALIAS_A })).not.toBe(
      oldEpoch,
    );
    expect(mockRuntime.addAccount).toHaveBeenCalledTimes(2);
    expect(mockRuntime.removeAccount).not.toHaveBeenCalled();
  });

  it('keeps the shared identity for a paused alias', async () => {
    const { capability, saveKey } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, SHARED_KEY);
    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_600_000,
    });
    await capability.enableAccount({
      accountId: ALIAS_B,
      birthdayHeight: 3_600_000,
    });
    await capability.syncGroup({
      accountIds: [ALIAS_A, ALIAS_B],
      chainTip: TIP,
    });
    await capability.disableAccount({ accountId: ALIAS_B });

    await capability.deleteRuntimeAccount({ accountId: ALIAS_A });
    expect(mockRuntime.identities).toHaveLength(1);
  });

  it('keeps a legacy paused balance readable before the first applied-epoch marker exists', async () => {
    const { capability, saveKey, xmr } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await seedScanState(xmr, ALIAS_A, 'paused', 3_000_000);
    await mockRuntime.addAccount(SHARED_FP, 'aa', 'bb', '3000000');
    expect(
      (await xmr.getXmrAccountState({ accountId: ALIAS_A })).appliedEpoch,
    ).toBeUndefined();
    await expect(
      capability.getAccountBalance({ accountId: ALIAS_A }),
    ).resolves.toMatchObject({ total: '1000000000000' });
  });

  it('removes a lone account identity, not one with another key', async () => {
    const { capability, saveKey } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, 'cc:dd');
    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_600_000,
    });
    await capability.enableAccount({
      accountId: ALIAS_B,
      birthdayHeight: 3_600_000,
    });
    await capability.syncGroup({
      accountIds: [ALIAS_A, ALIAS_B],
      chainTip: TIP,
    });

    await capability.deleteRuntimeAccount({ accountId: ALIAS_A });
    expect(mockRuntime.identities.map((item) => item.uuid)).toEqual([
      getViewingKeyFingerprint({ networkId: NETWORK_ID, viewingKey: 'cc:dd' }),
    ]);
  });

  it('adopts an identity still named by its old account id, sends included', async () => {
    const { capability, saveKey, xmr } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await seedScanState(xmr, ALIAS_A, 'on', 3_700_000);
    mockRuntime.identities.push({
      id: 7,
      uuid: ALIAS_A,
      primaryAddress: '4aabb',
      birthdayHeight: 3_600_000,
      sends: ['pending-outgoing'],
    });
    mockRuntime.nextId = 8;

    await capability.syncGroup({ accountIds: [ALIAS_A], chainTip: TIP });

    expect(mockRuntime.identities).toEqual([
      {
        id: 7,
        uuid: SHARED_FP,
        primaryAddress: '4aabb',
        birthdayHeight: 3_700_000,
        sends: ['pending-outgoing'],
      },
    ]);
    expect(mockRuntime.steppedIds).toEqual(['7']);
    expect(mockRuntime.removeAccount).not.toHaveBeenCalled();
  });

  it('applies the latest forward or backward target to every alias without replacing its identity', async () => {
    const { capability, saveKey, xmr } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, SHARED_KEY);
    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_000_000,
    });
    await capability.enableAccount({
      accountId: ALIAS_B,
      birthdayHeight: 3_000_000,
    });
    await capability.syncGroup({
      accountIds: [ALIAS_A, ALIAS_B],
      chainTip: TIP,
    });
    const identity = mockRuntime.identities[0];
    identity.sends.push('pending-send');
    for (const [accountId, height] of [
      [ALIAS_A, 3_600_000],
      [ALIAS_B, 3_100_000],
      [ALIAS_A, 3_700_000],
    ] as const) {
      await capability.rescan({ accountId, from: { type: 'height', height } });
    }
    const latest = await xmr.getXmrAccountState({ accountId: ALIAS_A });
    expect(await xmr.getXmrAccountState({ accountId: ALIAS_B })).toMatchObject({
      birthdayHeight: 3_700_000,
      epoch: latest.epoch,
    });
    await capability.syncGroup({
      accountIds: [ALIAS_B, ALIAS_A],
      chainTip: TIP,
    });
    expect(mockRuntime.identities).toEqual([
      expect.objectContaining({
        id: identity.id,
        birthdayHeight: 3_700_000,
        sends: ['pending-send'],
      }),
    ]);
    for (const accountId of [ALIAS_A, ALIAS_B]) {
      expect(await xmr.getXmrAccountState({ accountId })).toMatchObject({
        birthdayHeight: 3_700_000,
        epoch: latest.epoch,
        appliedEpoch: latest.epoch,
      });
    }
    expect(mockRuntime.removeAccount).not.toHaveBeenCalled();
  });

  it('forces an explicit same-birthday rescan while adopting a legacy UUID', async () => {
    const { capability, saveKey, xmr } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_000_000,
    });
    await capability.syncGroup({ accountIds: [ALIAS_A], chainTip: TIP });
    mockRuntime.identities[0].uuid = ALIAS_A;
    await capability.rescan({
      accountId: ALIAS_A,
      from: { type: 'height', height: 3_000_000 },
    });
    await capability.syncGroup({ accountIds: [ALIAS_A], chainTip: TIP });
    expect(mockRuntime.addAccount).toHaveBeenLastCalledWith(
      SHARED_FP,
      'aa',
      'bb',
      '3000000',
      true,
    );
    const current = await xmr.getXmrAccountState({ accountId: ALIAS_A });
    expect(current.appliedEpoch).toBe(current.epoch);
    expect(current.forceRescan).toBeUndefined();
    expect(mockRuntime.identities).toHaveLength(1);
  });

  it('does not cache an old step balance under a newly saved birthday', async () => {
    const { capability, saveKey, xmr, backgroundApi } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await capability.enableAccount({
      accountId: ALIAS_A,
      birthdayHeight: 3_000_000,
    });
    await capability.syncGroup({ accountIds: [ALIAS_A], chainTip: TIP });
    mockBusy = true;
    await capability.getAccountBalance({ accountId: ALIAS_A });
    mockBusy = false;
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      reached = resolve;
    });
    mockRuntime.syncStep.mockImplementationOnce(async () => {
      reached();
      await gate;
      return JSON.stringify({ blocksScanned: 1, done: true, outputsFound: 1 });
    });
    const old = capability.syncGroup({ accountIds: [ALIAS_A], chainTip: TIP });
    await requested;
    await capability.rescan({
      accountId: ALIAS_A,
      from: { type: 'height', height: 3_600_000 },
    });
    const latest = await xmr.getXmrAccountState({ accountId: ALIAS_A });
    release();
    await old;
    const cached =
      await backgroundApi.simpleDb.privacyChainCache.getLastBalance({
        accountId: ALIAS_A,
      });
    expect(cached?.epoch).not.toBe(latest.epoch);
    expect(mockRuntime.balance).not.toHaveBeenCalled();
  });
});

describe('xmr runtime orphan purge', () => {
  it('removes every identity not retained, old account-id names included', async () => {
    const { capability } = createHarness();
    const goneFp = getViewingKeyFingerprint({
      networkId: NETWORK_ID,
      viewingKey: 'ee:ff',
    });
    mockRuntime.identities.push(
      {
        id: 1,
        uuid: SHARED_FP,
        primaryAddress: '4aabb',
        birthdayHeight: 1,
        sends: [],
      },
      {
        id: 2,
        uuid: goneFp,
        primaryAddress: '4eeff',
        birthdayHeight: 1,
        sends: [],
      },
      {
        id: 3,
        uuid: 'hd-9--0',
        primaryAddress: '4old',
        birthdayHeight: 1,
        sends: [],
      },
    );

    await expect(
      capability.purgeRuntimeOrphans?.({
        retained: [
          { accountId: ALIAS_A, vkFp: SHARED_FP, viewingKey: SHARED_KEY },
        ],
      }),
    ).resolves.toBe(true);

    expect(mockRuntime.identities.map((item) => item.uuid)).toEqual([
      SHARED_FP,
    ]);
  });

  it('does not run behind a held runtime', async () => {
    const { capability } = createHarness();
    mockRuntime.identities.push({
      id: 1,
      uuid: 'hd-9--0',
      primaryAddress: '4old',
      birthdayHeight: 1,
      sends: [],
    });
    mockBusy = true;

    await expect(
      capability.purgeRuntimeOrphans?.({ retained: [] }),
    ).resolves.toBe(false);
    expect(mockRuntime.identities).toHaveLength(1);
  });

  it('lists only accounts whose scan data the runtime keeps', async () => {
    const { capability, xmr } = createHarness();
    // Nothing read is not "no accounts".
    await expect(capability.listScanDataAccountIds?.()).resolves.toBe(
      undefined,
    );
    await seedScanState(xmr, 'on', 'on');
    await seedScanState(xmr, 'paused', 'paused');
    await seedScanState(xmr, 'enabling', 'enabling');
    await seedScanState(xmr, 'deleted-data', 'deleted-data');
    await expect(capability.listScanDataAccountIds?.()).resolves.toEqual([
      'on',
      'paused',
      'enabling',
    ]);
  });
});
