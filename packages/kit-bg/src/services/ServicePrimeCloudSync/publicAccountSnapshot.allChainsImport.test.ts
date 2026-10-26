import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { vaultFactory } from '../../vaults/factory';
import {
  getVaultSettings,
  getVaultSettingsNetworkInfo,
} from '../../vaults/settings';

import {
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
  publicAccountIdentityEqual,
} from './publicAccountSnapshot';
import {
  PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS,
  publicAccountAllChainFixtures,
  publicAccountAllChainWallet,
} from './publicAccountSnapshot.allChains.test-utils';
import { importPublicAccountSnapshots } from './publicAccountSnapshotImport';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { LocalDbBase } from '../../dbs/local/LocalDbBase';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBCredentialBase,
  IDBWallet,
} from '../../dbs/local/types';
import type { VaultBase } from '../../vaults/base/VaultBase';

// Jest runs the identical installed CSL public API in its Node build. Browser
// The browser build is verified separately by the production renderer build.
jest.mock(
  '@emurgo/cardano-serialization-lib-asmjs/cardano_serialization_lib',
  () =>
    jest.requireActual<
      typeof import('@emurgo/cardano-serialization-lib-nodejs')
    >('@emurgo/cardano-serialization-lib-nodejs'),
);

// Keep real public SDK validation for the chain matrix; only the two scheduling
// tests below replace this writable test-module export with an explicit double.
jest.mock('./publicAccountSnapshotValidation', () => {
  const actual = jest.requireActual<
    typeof import('./publicAccountSnapshotValidation')
  >('./publicAccountSnapshotValidation');
  return {
    __esModule: true,
    ...actual,
    validatePublicAccount: (
      params: Parameters<typeof actual.validatePublicAccount>[0],
    ) => actual.validatePublicAccount(params),
  };
});

function harness(wallets: IDBWallet[], configuredNetworkIds: string[] = []) {
  const presets = getPresetNetworks();
  const template = presets[0];
  if (!template) throw new OneKeyLocalError('Missing preset network fixture');
  const configuredNetworks = configuredNetworkIds.map(
    (id) =>
      presets.find((item) => item.id === id) ?? {
        ...template,
        id,
        impl: networkUtils.getNetworkImpl({ networkId: id }),
        code: networkUtils.getNetworkImpl({ networkId: id }),
        isTestnet: id.includes('testnet'),
      },
  );
  const stored = new Map<string, IDBAccount>();
  const forbidden = jest.fn(() => {
    throw new OneKeyLocalError(
      'No secret, hardware or account creation is allowed',
    );
  });
  const getCredentialSafe = jest.fn(
    async (id: string): Promise<IDBCredentialBase | undefined> => ({
      id,
      credential: 'encrypted-local-fixture',
    }),
  );
  const write = jest.fn(
    async ({
      accounts,
      isCurrent,
    }: Parameters<LocalDbBase['importPublicCloudAccounts']>[0]) => {
      let added = 0;
      let unchanged = 0;
      let conflicts = 0;
      const appliedAccountIds: string[] = [];
      for (const account of accounts) {
        if (!isCurrent()) break;
        const existing = stored.get(account.id);
        if (existing && !publicAccountIdentityEqual(existing, account))
          conflicts += 1;
        else {
          if (existing) unchanged += 1;
          else {
            stored.set(account.id, account);
            added += 1;
          }
          appliedAccountIds.push(account.id);
        }
      }
      return {
        added,
        unchanged,
        conflicts,
        pending: 0,
        cancelled: false,
        appliedAccountIds,
      };
    },
  );
  const remove = jest.fn(
    async ({
      accounts,
    }: Parameters<LocalDbBase['deletePublicCloudAccounts']>[0]) => {
      let deleted = 0;
      let unchanged = 0;
      let conflicts = 0;
      const appliedAccountIds: string[] = [];
      for (const account of accounts) {
        const current = stored.get(account.id);
        if (current && !publicAccountIdentityEqual(current, account))
          conflicts += 1;
        else {
          if (current) {
            stored.delete(account.id);
            deleted += 1;
          } else unchanged += 1;
          appliedAccountIds.push(account.id);
        }
      }
      return {
        added: 0,
        unchanged,
        deleted,
        conflicts,
        pending: 0,
        cancelled: false,
        appliedAccountIds,
      };
    },
  );
  const api = {
    localDb: {
      getAllWallets: async () => ({ wallets }),
      getRecordsByIds: async ({ ids }: { ids: string[] }) => ({
        records: ids.map((id) => stored.get(id)),
      }),
      getCredentialSafe,
      getDeviceSafe: async () => ({ vendor: 'onekey' }),
      importPublicCloudAccounts: write,
      deletePublicCloudAccounts: remove,
      createAccounts: forbidden,
    },
    simpleDb: {
      customNetwork: { getAllCustomNetworks: async () => [] },
      serverNetwork: {
        getAllServerNetworks: async () => ({ networks: configuredNetworks }),
      },
    },
    serviceHardware: { getSDKInstance: forbidden },
    servicePassword: { getCachedPassword: forbidden },
  } as unknown as IBackgroundApi;
  const getVault = jest
    .spyOn(vaultFactory, 'getWalletOnlyVault')
    .mockImplementation(async ({ networkId }) => {
      const network = getPresetNetworks().find((item) => item.id === networkId);
      const info = await getVaultSettingsNetworkInfo({ networkId });
      return {
        backgroundApi: api,
        getVaultSettings: () => getVaultSettings({ networkId }),
        getCoreApiNetworkInfo: async () => ({
          ...info,
          networkId,
          networkImpl: networkUtils.getNetworkImpl({ networkId }),
          networkChainCode: network?.code,
          chainId: networkUtils.getNetworkChainId({ networkId }),
          isTestnet: network?.isTestnet,
        }),
        // Every nonempty public key/xpub is checked against its actual chain SDK.
        // Real address-only Vaults are exercised by the validation suite.
        validateAddress: async (address: string) => ({
          isValid: Boolean(address),
          normalizedAddress: address.toLowerCase(),
        }),
        validateXpub: async () => ({ isValid: true }),
        keyring: { prepareAccounts: forbidden },
      } as unknown as VaultBase;
    });
  return { api, stored, forbidden, write, remove, getCredentialSafe, getVault };
}

afterEach(() => jest.restoreAllMocks());

test.each(PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS)(
  '%s traverses the production importer without secrets or hardware',
  async (impl) => {
    const fixtures = await publicAccountAllChainFixtures();
    const h = harness(
      [
        publicAccountAllChainWallet('hd', 'hd-receiver'),
        {
          ...publicAccountAllChainWallet('hardware', 'hw-receiver'),
          associatedDevice: 'local-device',
        },
      ],
      fixtures.map((item) => item.networkId),
    );
    const fixture = fixtures.find((item) => item.impl === impl);
    if (!fixture) throw new OneKeyLocalError('Missing chain fixture');
    const snapshot = buildPublicAccountSnapshot({
      wallet: publicAccountAllChainWallet(fixture.kind),
      account: fixture.account,
    });
    expect(snapshot).toBeDefined();
    const result = await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots: [snapshot],
      isCurrent: () => true,
    });
    expect({
      impl: fixture.impl,
      added: result.added,
      pending: result.pending,
      rejected: result.rejected,
    }).toEqual({ impl: fixture.impl, added: 1, pending: 0, rejected: 0 });
    const again = await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots: [snapshot],
      isCurrent: () => true,
    });
    expect({ impl: fixture.impl, unchanged: again.unchanged }).toEqual({
      impl: fixture.impl,
      unchanged: 1,
    });
    if (!snapshot) throw new OneKeyLocalError('Missing public fixture');
    const id = getPublicAccountSnapshotId(snapshot);
    const source: IDBCloudSyncItem = {
      id,
      dataType: EPrimeCloudSyncDataType.Account,
      data: 'public-fixture-ciphertext',
      dataTime: 2,
      pwdHash: 'test-space',
      rawData: '',
      rawKey: '',
      isDeleted: true,
      localSceneUpdated: false,
      serverUploaded: true,
    };
    const deleted = await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots: [snapshot],
      sourceItemsBySnapshotId: new Map([[id, source]]),
      action: 'delete',
      isCurrent: () => true,
    });
    expect({ impl: fixture.impl, deleted: deleted.deleted }).toEqual({
      impl: fixture.impl,
      deleted: 1,
    });
    const restored = await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots: [snapshot],
      isCurrent: () => true,
    });
    expect({ impl: fixture.impl, restored: restored.added }).toEqual({
      impl: fixture.impl,
      restored: 1,
    });
    expect(h.stored.size).toBe(1);
    expect(h.forbidden).not.toHaveBeenCalled();
    expect(
      h.write.mock.calls.every(([params]) => params.accounts.length <= 50),
    ).toBe(true);
  },
);

test('unmatched wallets stop before public validation or writes', async () => {
  const fixtures = await publicAccountAllChainFixtures();
  const snapshots = fixtures.map((fixture) =>
    buildPublicAccountSnapshot({
      wallet: publicAccountAllChainWallet(fixture.kind),
      account: fixture.account,
    }),
  );
  const h = harness([]);
  const missing = await importPublicAccountSnapshots({
    backgroundApi: h.api,
    snapshots,
    isCurrent: () => true,
  });
  expect(missing).toMatchObject({ added: 0, pending: 32 });
  expect(h.getVault).not.toHaveBeenCalled();
  expect(h.write).not.toHaveBeenCalled();
  expect(h.forbidden).not.toHaveBeenCalled();
});

test('missing local software credential leaves a v2 record pending before public validation', async () => {
  const fixture = (await publicAccountAllChainFixtures()).find(
    (item) => item.impl === 'sol',
  );
  if (!fixture) throw new OneKeyLocalError('Missing software fixture');
  const snapshot = buildPublicAccountSnapshot({
    wallet: publicAccountAllChainWallet('hd'),
    account: fixture.account,
  });
  const h = harness([publicAccountAllChainWallet('hd', 'hd-receiver')]);
  h.getCredentialSafe.mockResolvedValue(undefined);
  expect(
    await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots: [snapshot],
      isCurrent: () => true,
    }),
  ).toMatchObject({ added: 0, pending: 1 });
  expect(h.getVault).not.toHaveBeenCalled();
  expect(h.write).not.toHaveBeenCalled();
  expect(h.forbidden).not.toHaveBeenCalled();
});

test('v2 public BIP32 checkpoints survive cancellation and do not repeat accepted calculations', async () => {
  const fixture = (await publicAccountAllChainFixtures()).find(
    (item) => item.impl === 'tbtc',
  );
  if (!fixture) throw new OneKeyLocalError('Missing public scheduling fixture');
  const base = buildPublicAccountSnapshot({
    wallet: publicAccountAllChainWallet('hd'),
    account: fixture.account,
  });
  if (!base) throw new OneKeyLocalError('Missing public snapshot');
  // Scheduling double only: cryptographic association is covered by real vectors
  // above; these records deliberately share a test-only public node.
  const validator = await import('./publicAccountSnapshotValidation');
  const validate = jest
    .spyOn(validator, 'validatePublicAccount')
    .mockResolvedValue(true);
  const snapshots = Array.from({ length: 4 }, (_, index) => ({
    ...base,
    account: {
      ...base.account,
      pathIndex: index,
      path: accountUtils
        .buildPathFromTemplate({ template: base.account.template, index })
        .replace(/\/0\/0$/, ''),
    },
  }));
  const h = harness(
    [publicAccountAllChainWallet('hd', 'hd-receiver')],
    [fixture.networkId],
  );
  let current = true;
  const apply = h.write.getMockImplementation();
  if (!apply) throw new OneKeyLocalError('Missing write double');
  h.write.mockImplementationOnce(async (params) => {
    const result = await apply(params);
    current = false;
    return result;
  });
  const interrupted = await importPublicAccountSnapshots({
    backgroundApi: h.api,
    snapshots,
    isCurrent: () => current,
  });
  expect(interrupted).toMatchObject({ added: 2, cancelled: true });
  expect(validate).toHaveBeenCalledTimes(2);
  current = true;
  const resumed = await importPublicAccountSnapshots({
    backgroundApi: h.api,
    snapshots,
    isCurrent: () => current,
  });
  expect(resumed).toMatchObject({ added: 2, unchanged: 2, cancelled: false });
  expect(validate).toHaveBeenCalledTimes(4);
  expect(h.stored.size).toBe(4);
  expect(
    h.write.mock.calls.every(([params]) => params.accounts.length <= 2),
  ).toBe(true);
  expect(h.forbidden).not.toHaveBeenCalled();
});

test('1000 inexpensive v2 records retain 50-record writes and one wallet credential lookup', async () => {
  const fixture = (await publicAccountAllChainFixtures()).find(
    (item) => item.impl === 'sol',
  );
  if (!fixture)
    throw new OneKeyLocalError('Missing software scheduling fixture');
  const base = buildPublicAccountSnapshot({
    wallet: publicAccountAllChainWallet('hd'),
    account: fixture.account,
  });
  if (!base) throw new OneKeyLocalError('Missing software snapshot');
  const validator = await import('./publicAccountSnapshotValidation');
  const validate = jest
    .spyOn(validator, 'validatePublicAccount')
    .mockResolvedValue(true);
  const snapshots = Array.from({ length: 1000 }, (_, index) => ({
    ...base,
    account: {
      ...base.account,
      pathIndex: index,
      path: accountUtils.buildPathFromTemplate({
        template: base.account.template,
        index,
      }),
    },
  }));
  const h = harness([publicAccountAllChainWallet('hd', 'hd-receiver')]);
  expect(
    await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots,
      isCurrent: () => true,
    }),
  ).toMatchObject({ added: 1000, pending: 0 });
  expect(h.write).toHaveBeenCalledTimes(20);
  expect(h.getCredentialSafe).toHaveBeenCalledTimes(1);
  expect(validate).toHaveBeenCalledTimes(1000);
  expect(h.forbidden).not.toHaveBeenCalled();
});
