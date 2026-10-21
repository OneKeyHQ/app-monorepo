import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

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

// The runtime names an identity by the viewing key fingerprint (vkFp). The
// fake below follows monero-runtime's add_identity (wallet.rs): idempotent by
// uuid; the same uuid with other keys starts clean; the same keys under a new
// uuid are renamed, keeping the row and everything linked to it.

const NETWORK_ID = 'xmr--0';
const TIP = 3_768_162;

type IFakeIdentity = {
  id: number;
  uuid: string;
  primaryAddress: string;
  birthdayHeight: number;
  // Stands in for outputs, transactions and pending sends linked by row id.
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
    });
  }

  addAccount = jest.fn(
    async (uuid: string, spend: string, view: string, birthday: string) => {
      const primaryAddress = `4${spend}${view}`;
      const byUuid = this.identities.find((item) => item.uuid === uuid);
      if (byUuid) {
        if (byUuid.primaryAddress === primaryAddress) return this.row(byUuid);
        this.identities = this.identities.filter((item) => item !== byUuid);
      }
      const byAddress = this.identities.find(
        (item) => item.primaryAddress === primaryAddress,
      );
      if (byAddress) {
        byAddress.uuid = uuid;
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

  rewindTo = jest.fn(async () => '{}');

  syncPeek = jest.fn(async () =>
    JSON.stringify({ scannedToHeight: 3_700_000, ranges: [] }),
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
// The real lookup (account -> stored key -> vkFp -> runtime row); only the
// session and node are replaced.
jest.mock('./runtime', () => ({
  ...jest.requireActual('./runtime'),
  getXmrRuntime: async () => mockRuntime,
  getXmrLocalRuntime: async () => mockRuntime,
  getXmrChainTip: async () => TIP,
  getXmrLastKnownChainTip: async () => TIP,
  isXmrRuntimeBusy: () => mockBusy,
}));

function memoryEntity<T>(entity: T): T {
  let saved: unknown = null;
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

type IScanStateKind = 'on' | 'paused' | 'enabling' | 'deleted-data';

// Builds each state through the entity's own operations.
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
    await xmr.removeXmrAccount({ accountId, keepBirthday: true });
  }
}

function createHarness() {
  const xmr = memoryEntity(new SimpleDbEntityPrivacyChainState());
  const privacyChainKeys = memoryEntity(new SimpleDbEntityPrivacyChainKeys());
  const backgroundApi = {
    servicePrivacyChain: {
      publishLocalWalletSyncProgress: jest.fn(async () => undefined),
      onLocalWalletAccountsChanged: jest.fn(async () => undefined),
    },
    simpleDb: {
      privacyChainState: xmr,
      privacyChainKeys,
      privacyChainCache: memoryEntity(new SimpleDbEntityPrivacyChainCache()),
      privacyChainJournal: {
        removeXmrSentAccount: jest.fn(async () => undefined),
      },
    },
  };
  const vault = {
    networkId: NETWORK_ID,
    backgroundApi,
    getXmrNetwork: async () => 'mainnet',
    resolveXmrNodeUrl: async () => 'https://node.example:18081',
    // As Vault.getXmrViewingKeys: the stored key, parsed.
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

    await capability.enableAccount({ accountId: ALIAS_A });
    await capability.enableAccount({ accountId: ALIAS_B });

    expect(mockRuntime.addAccount.mock.calls.map(([uuid]) => uuid)).toEqual([
      SHARED_FP,
      SHARED_FP,
    ]);
    expect(mockRuntime.identities).toHaveLength(1);
    expect(mockRuntime.identities[0].uuid).toBe(SHARED_FP);

    // One slot, one alias group, one scan per turn.
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
    expect(mockRuntime.steppedIds).toEqual(['1']);
  });

  it('keeps the shared identity while another alias still uses it', async () => {
    const { capability, saveKey } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, SHARED_KEY);
    await capability.enableAccount({ accountId: ALIAS_A });
    await capability.enableAccount({ accountId: ALIAS_B });

    await capability.deleteAccountData({ accountId: ALIAS_A });
    expect(mockRuntime.removeAccount).not.toHaveBeenCalled();
    expect(mockRuntime.identities).toHaveLength(1);

    // The last one out removes it.
    await capability.reset({ accountId: ALIAS_B, scope: 'all' });
    expect(mockRuntime.removeAccount).toHaveBeenCalledWith(SHARED_FP);
    expect(mockRuntime.identities).toHaveLength(0);
  });

  it('keeps the shared identity for a paused alias', async () => {
    const { capability, saveKey } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, SHARED_KEY);
    await capability.enableAccount({ accountId: ALIAS_A });
    await capability.enableAccount({ accountId: ALIAS_B });
    await capability.disableAccount({ accountId: ALIAS_B });

    await capability.reset({ accountId: ALIAS_A, scope: 'all' });
    expect(mockRuntime.identities).toHaveLength(1);
  });

  it('removes a lone account identity, not one with another key', async () => {
    const { capability, saveKey } = createHarness();
    await saveKey(ALIAS_A, SHARED_KEY);
    await saveKey(ALIAS_B, 'cc:dd');
    await capability.enableAccount({ accountId: ALIAS_A });
    await capability.enableAccount({ accountId: ALIAS_B });

    await capability.deleteAccountData({ accountId: ALIAS_A });
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

    // Renamed in place: same row, same scan data and pending send.
    expect(mockRuntime.identities).toEqual([
      {
        id: 7,
        uuid: SHARED_FP,
        primaryAddress: '4aabb',
        birthdayHeight: 3_600_000,
        sends: ['pending-outgoing'],
      },
    ]);
    expect(mockRuntime.steppedIds).toEqual(['7']);
    expect(mockRuntime.removeAccount).not.toHaveBeenCalled();
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
