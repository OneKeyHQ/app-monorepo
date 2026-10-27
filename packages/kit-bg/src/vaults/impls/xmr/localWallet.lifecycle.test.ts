import { setXmrRuntimeApiLoader } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import type { IXmrRuntimeApi } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime';
import { SimpleDbEntityPrivacyChainCache } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainKeys } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { getXmrLifecycleMutex } from '@onekeyhq/kit-bg/src/vaults/impls/xmr/lifecycle';
import { buildXmrLocalWalletCapability } from '@onekeyhq/kit-bg/src/vaults/impls/xmr/localWallet';
import {
  resetXmrRuntimeSession,
  resetXmrStaleFirstCache,
} from '@onekeyhq/kit-bg/src/vaults/impls/xmr/runtime';
import type Vault from '@onekeyhq/kit-bg/src/vaults/impls/xmr/Vault';
import { saveLocalWalletViewingKey } from '@onekeyhq/kit-bg/src/vaults/localWallet/viewingKeyStore';
import { createUntrackedMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

jest.mock('@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/install', () => ({
  installXmrCarrier: () => undefined,
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const pass =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return { ...actual, backgroundClass: pass, backgroundMethod: pass };
});
jest.mock('@onekeyhq/kit-bg/src/vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('@onekeyhq/kit-bg/src/vaults/settings', () => ({
  getVaultSettings: async () => ({}),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  privacyChainAtom: {
    set: async (update: unknown) =>
      typeof update === 'function'
        ? (update as (state: unknown) => unknown)({
            progress: {},
            syncErrorByNetworkId: {},
            storageUnsupportedNetworkIds: [],
            pausedNetworkIds: [],
            preparingNetworkIds: [],
          })
        : update,
  },
}));
const ServicePrivacyChain =
  require('@onekeyhq/kit-bg/src/services/ServicePrivacyChain')
    .default as typeof import('@onekeyhq/kit-bg/src/services/ServicePrivacyChain').default;

const accountId = 'hd-1--xmr';
const networkId = 'xmr--0';
const tip = 3_767_827;
const timestamp = Date.UTC(2024, 0, 1);
function memory<T extends { appStorage: unknown }>(entity: T): T {
  const storage = createUntrackedMemoryStorage(null);
  entity.appStorage = { getItem: storage.getItem, setItem: storage.setItem };
  return entity;
}

async function setup() {
  resetXmrRuntimeSession();
  resetXmrStaleFirstCache();
  const state = memory(new SimpleDbEntityPrivacyChainState());
  const keys = memory(new SimpleDbEntityPrivacyChainKeys());
  const cache = memory(new SimpleDbEntityPrivacyChainCache());
  const rows = new Map<
    string,
    { accountId: number; uuid: string; birthdayHeight: number }
  >();
  const runtime = {
    openWallet: jest.fn(async () => '{}'),
    setNodeUrl: jest.fn(async () => '{}'),
    chainTip: jest.fn(async () => JSON.stringify({ height: tip })),
    listAccounts: jest.fn(async () =>
      JSON.stringify({ items: [...rows.values()] }),
    ),
    addAccount: jest.fn(
      async (uuid: string, _spend: string, _view: string, birthday: string) => {
        const row = rows.get(uuid) ?? {
          accountId: 3,
          uuid,
          birthdayHeight: Number(birthday),
        };
        rows.set(uuid, row);
        return JSON.stringify(row);
      },
    ),
    syncPeek: jest.fn(async () =>
      JSON.stringify({
        scannedToHeight: null,
        ranges: [],
        birthdayHeight: [...rows.values()][0]?.birthdayHeight,
      }),
    ),
    updateChainTip: jest.fn(async () => '{}'),
    syncStep: jest.fn(async () =>
      JSON.stringify({ done: true, outputsFound: 0, blocksScanned: 1 }),
    ),
    rewindTo: jest.fn(async () => '{}'),
    removeAccount: jest.fn(async (uuid: string) => {
      rows.delete(uuid);
      return '{}';
    }),
  };
  setXmrRuntimeApiLoader(async () => runtime as unknown as IXmrRuntimeApi);
  const backgroundApi = {
    simpleDb: {
      privacyChainState: state,
      privacyChainKeys: keys,
      privacyChainCache: cache,
      privacyChainXmrSent: { removeAccounts: async () => undefined },
    },
    servicePrivacyChain: {
      onLocalWalletAccountsChanged: async () => undefined,
      ensureLocalWalletViewingKey: async () => 'synthetic-key',
      publishLocalWalletSyncProgress: async () => undefined,
    },
  };
  const saved = await saveLocalWalletViewingKey({
    backgroundApi: backgroundApi as never,
    networkId,
    accountId,
    value: 'synthetic-key-pair',
  });
  const vault = {
    networkId,
    getXmrNetwork: async () => 'mainnet',
    resolveXmrNodeUrl: async () => 'https://example.invalid',
    getXmrViewingKeys: async () => ({
      vkFp: saved.vkFp,
      primaryAddress: 'synthetic',
      spendPublicKeyHex: '11'.repeat(32),
      viewPrivateKeyHex: '22'.repeat(32),
    }),
    backgroundApi,
  } as unknown as Vault;
  const cap = buildXmrLocalWalletCapability(vault);
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as object,
    {
      backgroundApi,
      enableMutexByNetwork: new Map(),
      onLocalWalletAccountsChanged: jest.fn(async () => undefined),
      syncFailureBackoff: new Map(),
      orphanCleanupGeneration: new Map(),
      backfillActiveByAccount: {},
      requireAccountCapability: async () => cap,
      assertNotTempWalletAccount: async () => undefined,
      isPersistenceMasked: async () => false,
      scheduleBackgroundSync: jest.fn(),
      forgetCachedLocalWalletBalance: async () => undefined,
    },
  ) as unknown as InstanceType<typeof ServicePrivacyChain>;
  return { cap, state, keys, runtime, rows, saved, vault, service };
}

afterEach(() => {
  resetXmrRuntimeSession();
  resetXmrStaleFirstCache();
});

test('pause and resume preserve a pending recovery date before the first registration', async () => {
  const { cap, service, state, runtime } = await setup();
  await service.enableLocalWalletAccount({
    networkId,
    accountId,
    birthdayTimestamp: timestamp,
  });
  expect(await state.getXmrAccountState({ accountId })).toMatchObject({
    birthdaySource: 'pending-timestamp',
    birthdayTimestamp: timestamp,
    birthdayHeight: 1,
  });
  await service.disableLocalWalletAccount({ networkId, accountId });
  await service.enableLocalWalletAccount({ networkId, accountId });
  await cap.syncGroup({ accountIds: [accountId], chainTip: tip });
  expect(Number(runtime.addAccount.mock.calls[0][3])).toBeGreaterThan(1);
  const result = await state.getXmrAccountState({ accountId });
  expect(result).toMatchObject({
    intent: 'on',
    birthdayTimestamp: timestamp,
    birthdaySource: 'restore-month',
  });
});

test('an obsolete registration cannot restore the identity after Service deletion completes', async () => {
  const { cap, state, keys, runtime, rows, saved, vault, service } =
    await setup();
  await cap.enableAccount({ accountId, birthdayHeight: 3_000_000 });
  let release: () => void = () => undefined;
  let reached: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const originalKeys = vault.getXmrViewingKeys.bind(vault);
  vault.getXmrViewingKeys = async (params) => {
    const captured = await originalKeys(params);
    reached();
    await gate;
    return captured;
  };
  const turn = cap
    .syncGroup({ accountIds: [accountId], chainTip: tip })
    .catch((error: unknown) => error);
  await requested;
  await service.deleteLocalWalletAccountData({ networkId, accountId });
  await service.resumePendingAccountDeletions();
  expect(rows.size).toBe(0);
  release();
  await turn;
  expect((await state.getXmrAccountState({ accountId })).intent).toBe('off');
  expect(await keys.getKey({ accountId })).toBeUndefined();
  expect(runtime.addAccount).not.toHaveBeenCalled();
  expect(rows.has(saved.vkFp)).toBe(false);
  expect(runtime.syncStep).not.toHaveBeenCalled();
});

test.each(['rescan', 'legacy enable recovery'] as const)(
  'an obsolete %s awaiting a viewing key cannot re-enable an account deleted by the Service',
  async (operation) => {
    const { cap, state, keys, runtime, vault, service } = await setup();
    if (operation === 'rescan')
      await cap.enableAccount({ accountId, birthdayHeight: 3_000_000 });
    else
      await state.beginXmrEnable({
        networkId,
        accountId,
        birthdayHeight: 3_000_000,
      });
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const original = vault.getXmrViewingKeys.bind(vault);
    vault.getXmrViewingKeys = async (params) => {
      const captured = await original(params);
      reached();
      await gate;
      return captured;
    };
    const rescan =
      operation === 'rescan'
        ? cap.rescan({ accountId, from: { type: 'height', height: 3_500_000 } })
        : cap.retryAccountSetup({ accountId });
    await requested;
    await service.deleteLocalWalletAccountData({ networkId, accountId });
    await service.resumePendingAccountDeletions();
    const deleted = await state.getXmrAccountState({ accountId });
    release();
    await rescan;
    expect(await state.getXmrAccountState({ accountId })).toEqual(deleted);
    expect(deleted.intent).toBe('off');
    expect(await keys.getKey({ accountId })).toBeUndefined();
    await cap.syncGroup({ accountIds: [accountId], chainTip: tip });
    expect(runtime.addAccount).not.toHaveBeenCalled();
  },
);

test('a newly authorized account remains excluded from runtime work until deletion completes', async () => {
  const { cap, state, runtime } = await setup();
  await cap.enableAccount({ accountId, birthdayHeight: 3_000_000 });
  const request = await state.requestAccountDeletion({ networkId, accountId });
  await state.beginAccountReenable(request);
  await cap.enableAccount({ accountId, birthdayHeight: 3_500_000 });
  await cap.syncGroup({ accountIds: [accountId], chainTip: tip });
  expect(runtime.addAccount).not.toHaveBeenCalled();
  expect(runtime.syncStep).not.toHaveBeenCalled();
  await state.completeAccountDeletion(request);
  await cap.syncGroup({ accountIds: [accountId], chainTip: tip });
  expect(runtime.addAccount).toHaveBeenCalled();
});

test('serializes deletion of two aliases through host cleanup before purging their shared runtime identity', async () => {
  const { cap, state, keys, runtime, service, saved, rows } = await setup();
  const alias = 'hd-1--alias';
  await keys.saveKey({
    accountId: alias,
    record: {
      networkId,
      vkFp: saved.vkFp,
      sealed: { format: 'plain', value: 'synthetic-key-pair' },
    },
  });
  await cap.enableAccount({ accountId, birthdayHeight: 3_000_000 });
  await cap.enableAccount({ accountId: alias, birthdayHeight: 3_000_000 });
  await cap.syncGroup({ accountIds: [accountId], chainTip: tip });
  expect(rows.has(saved.vkFp)).toBe(true);
  await Promise.all([
    service.deleteLocalWalletAccountData({ networkId, accountId }),
    service.deleteLocalWalletAccountData({ networkId, accountId: alias }),
  ]);
  await service.resumePendingAccountDeletions();
  expect(await state.listPendingAccountDeletions()).toEqual([]);
  expect(await keys.listAccountIds()).toEqual([]);
  expect(rows.has(saved.vkFp)).toBe(false);
  expect(runtime.removeAccount).toHaveBeenCalledTimes(1);
});

async function setupTwins() {
  const fixture = await setup();
  const twin = 'hd-1--twin';
  await fixture.keys.saveKey({
    accountId: twin,
    record: {
      networkId,
      vkFp: fixture.saved.vkFp,
      sealed: { format: 'plain', value: 'synthetic-key-pair' },
    },
  });
  await fixture.cap.enableAccount({ accountId, birthdayHeight: 3_000_000 });
  await fixture.cap.enableAccount({
    accountId: twin,
    birthdayHeight: 3_000_000,
  });
  await fixture.cap.syncGroup({ accountIds: [accountId], chainTip: tip });
  expect(fixture.rows.has(fixture.saved.vkFp)).toBe(true);
  return { ...fixture, twin };
}

test('deleting one twin deletes the other and removes their shared runtime identity once', async () => {
  const { state, keys, runtime, service, saved, rows, twin } =
    await setupTwins();
  await service.deleteLocalWalletAccountData({ networkId, accountId });
  await service.resumePendingAccountDeletions();
  expect(await state.listPendingAccountDeletions()).toEqual([]);
  expect(await keys.listAccountIds()).toEqual([]);
  expect(await state.getXmrAccountState({ accountId: twin })).toMatchObject({
    intent: 'off',
  });
  expect(rows.has(saved.vkFp)).toBe(false);
  expect(runtime.removeAccount).toHaveBeenCalledTimes(1);
});

test.each([
  {
    title: 'a twin being deleted does not keep the shared identity',
    reenabled: false,
    removed: true,
  },
  {
    title: 'a twin re-enabled during its deletion keeps the shared identity',
    reenabled: true,
    removed: false,
  },
])('$title', async ({ reenabled, removed }) => {
  const { cap, state, runtime, saved, rows, twin } = await setupTwins();
  const twinRequest = await state.requestAccountDeletion({
    networkId,
    accountId: twin,
  });
  if (reenabled) {
    await state.beginAccountReenable(twinRequest);
    await cap.enableAccount({ accountId: twin, birthdayHeight: 3_000_000 });
  }
  const request = await state.requestAccountDeletion({
    networkId,
    accountId,
  });
  await expect(
    cap.deleteRuntimeAccount({
      accountId,
      deletionRequestId: request.requestId,
    }),
  ).resolves.toEqual({ orphaned: false });
  expect(rows.has(saved.vkFp)).toBe(!removed);
  expect(runtime.removeAccount).toHaveBeenCalledTimes(removed ? 1 : 0);
});

test('a delayed obsolete deletion cannot remove an account authorized after a newer deletion', async () => {
  const { cap, state, runtime } = await setup();
  await cap.enableAccount({ accountId, birthdayHeight: 3_000_000 });
  const old = await state.requestAccountDeletion({ networkId, accountId });
  const release = await getXmrLifecycleMutex(networkId).acquire();
  const deleting = cap.deleteRuntimeAccount({
    accountId,
    deletionRequestId: old.requestId,
  });
  try {
    await state.beginAccountReenable(old);
    await cap.enableAccount({ accountId, birthdayHeight: 3_000_000 });
    const latest = await state.requestAccountDeletion({ networkId, accountId });
    await state.completeAccountDeletion(latest);
    await cap.enableAccount({ accountId, birthdayHeight: 3_500_000 });
  } finally {
    release();
  }
  await deleting;
  expect(runtime.removeAccount).not.toHaveBeenCalled();
  expect(await state.getXmrAccountState({ accountId })).toMatchObject({
    intent: 'on',
    birthdayHeight: 3_500_000,
  });
});
