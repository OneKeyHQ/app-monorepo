import { createHash } from 'crypto';

import { cloneDeep } from 'lodash';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { withPublicAccountCreationContext } from '../../services/ServicePrimeCloudSync/publicAccountCreationContext';
import {
  buildPublicAccountSnapshot,
  publicAccountSnapshotToAccount,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot';
import {
  PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS,
  publicAccountAllChainFixtures,
  publicAccountAllChainWallet,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.allChains.test-utils';
import { rememberPublicAccountSnapshotWrite } from '../../services/ServicePrimeCloudSync/publicAccountSnapshotWriteGuard';

import { EDBAccountType } from './consts';
import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type {
  IDBAccount,
  IDBBaseObject,
  IDBCloudSyncItem,
  IDBWallet,
  ILocalDBGetRecordsByIdsParams,
  ILocalDBGetRecordsByIdsResult,
  ILocalDBRecord,
  ILocalDBTransaction,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxGetRecordByIdParams,
  ILocalDBTxGetRecordByIdResult,
  ILocalDBTxGetRecordsByIdsParams,
  ILocalDBTxGetRecordsByIdsResult,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
} from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const XFP = `12345678--xpub${'A'.repeat(107)}`;
const WALLET: IDBWallet = {
  id: 'hd-1',
  type: 'hd',
  name: 'Local wallet',
  xfp: XFP,
  accounts: [],
  nextIds: {},
  walletNo: 1,
  backuped: true,
};

function account(index = 0): IDBAccount {
  return {
    id: `hd-1--m/44'/60'/0'/0/${index}`,
    indexedAccountId: `hd-1--${index}`,
    name: 'Cloud name',
    type: EDBAccountType.SIMPLE,
    impl: 'evm',
    coinType: '60',
    path: `m/44'/60'/0'/0/${index}`,
    pathIndex: index,
    template: "m/44'/60'/0'/0/$$INDEX$$",
    address: '0x1111111111111111111111111111111111111111',
    pub: '',
  };
}

class PublicAccountTestDb extends LocalDbBase {
  override readyDb = Promise.resolve(this);

  stores = new Map<ELocalDBStoreNames, Map<string, IDBBaseObject>>();

  writes: ELocalDBStoreNames[] = [];

  beforeTransaction?: () => void;

  afterWrite?: () => void;

  constructor() {
    super();
    this.put(ELocalDBStoreNames.Wallet, cloneDeep(WALLET));
    this.put(ELocalDBStoreNames.Credential, {
      id: WALLET.id,
      credential: 'encrypted-local-test-credential',
    });
  }

  put<T extends IDBBaseObject>(name: ELocalDBStoreNames, record: T) {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    store.set(record.id, record);
  }

  override async reset() {}

  override async getWallet({ walletId }: { walletId: string }) {
    const value = this.stores.get(ELocalDBStoreNames.Wallet)?.get(walletId) as
      | IDBWallet
      | undefined;
    if (!value) throw new OneKeyLocalError('Missing test wallet');
    return { ...value };
  }

  override async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    return this.txGetRecordsByIds({ ...params, tx: {} as ILocalDBTransaction });
  }

  override async withTransaction<T>(
    _bucket: EIndexedDBBucketNames,
    fn: (tx: ILocalDBTransaction) => Promise<T>,
  ): Promise<T> {
    this.beforeTransaction?.();
    const original = cloneDeep(this.stores);
    try {
      return await fn({} as ILocalDBTransaction);
    } catch (error) {
      this.stores = original;
      throw error;
    }
  }

  override async txGetRecordsByIds<T extends ELocalDBStoreNames>({
    name,
    ids,
  }: ILocalDBTxGetRecordsByIdsParams<T>): Promise<
    ILocalDBTxGetRecordsByIdsResult<T>
  > {
    const records = ids.map(
      (id) => this.stores.get(name)?.get(id) as ILocalDBRecord<T> | undefined,
    );
    return {
      records,
      recordPairs: records.map((record) =>
        record ? [record, null] : undefined,
      ),
    };
  }

  override async txGetRecordById<T extends ELocalDBStoreNames>({
    tx,
    name,
    id,
  }: ILocalDBTxGetRecordByIdParams<T>): Promise<
    ILocalDBTxGetRecordByIdResult<T>
  > {
    const result = await this.txGetRecordsByIds({ tx, name, ids: [id] });
    const pair = result.recordPairs[0];
    if (!pair) throw new OneKeyLocalError('Missing test record');
    return pair;
  }

  readWallet() {
    return this.stores
      .get(ELocalDBStoreNames.Wallet)
      ?.get(WALLET.id) as IDBWallet;
  }

  override async txAddRecords<T extends ELocalDBStoreNames>({
    name,
    records,
  }: ILocalDBTxAddRecordsParams<T>): Promise<ILocalDBTxAddRecordsResult> {
    this.writes.push(name);
    const addedIds: string[] = [];
    for (const record of records) {
      if (!this.stores.get(name)?.has(record.id)) {
        this.put(name, { ...record });
        addedIds.push(record.id);
      }
    }
    this.afterWrite?.();
    return {
      added: addedIds.length,
      addedIds,
      skipped: records.length - addedIds.length,
    };
  }

  override async txGetAllRecords<T extends ELocalDBStoreNames>({
    name,
  }: ILocalDBTxGetAllRecordsParams<T>): Promise<
    ILocalDBTxGetAllRecordsResult<T>
  > {
    const records = Array.from(
      this.stores.get(name)?.values() ?? [],
    ) as ILocalDBRecord<T>[];
    return { records, recordPairs: records.map((record) => [record, null]) };
  }

  override async txRemoveRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
  }: ILocalDBTxRemoveRecordsParams<T>) {
    this.writes.push(name);
    for (const id of ids) this.stores.get(name)?.delete(id);
    this.afterWrite?.();
  }

  override async txUpdateRecords<T extends ELocalDBStoreNames>({
    name,
    ids = [],
    updater,
  }: ILocalDBTxUpdateRecordsParams<T>) {
    this.writes.push(name);
    for (const id of ids) {
      const current = this.stores.get(name)?.get(id) as
        | ILocalDBRecord<T>
        | undefined;
      if (current) {
        const input = { ...current };
        const updated = await updater(input);
        if (
          this.useRealAvatarHashes &&
          name === ELocalDBStoreNames.IndexedAccount &&
          updated !== input
        ) {
          throw new OneKeyLocalError('Realm requires its original object');
        }
        this.put(name, updated);
      }
    }
    this.afterWrite?.();
  }

  useRealAvatarHashes = false;

  override async buildIndexedAccountIdHash(
    params: Parameters<LocalDbBase['buildIndexedAccountIdHash']>[0],
  ) {
    return this.useRealAvatarHashes
      ? super.buildIndexedAccountIdHash(params)
      : 'public-test-avatar-hash';
  }

  run(accounts: IDBAccount[], isCurrent = () => true) {
    return this.importPublicCloudAccounts({
      walletId: WALLET.id,
      expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
      expectedCredential: 'encrypted-local-test-credential',
      accounts,
      isCurrent,
    });
  }

  prepareSources(accounts: IDBAccount[], isDeleted = true, dataTime = 2) {
    const sources = new Map<string, IDBCloudSyncItem>();
    for (const value of accounts) {
      const source: IDBCloudSyncItem = {
        id: `source:${value.id}`,
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey: '',
        rawData: '',
        data: `public-test-source-${dataTime}`,
        dataTime,
        isDeleted,
        pwdHash: 'public-test-cloud',
        localSceneUpdated: false,
        serverUploaded: true,
      };
      sources.set(value.id, source);
      this.put(ELocalDBStoreNames.CloudSyncItem, { ...source });
    }
    return sources;
  }

  delete(
    accounts: IDBAccount[],
    sourceItemsByAccountId = this.prepareSources(accounts),
    isCurrent = () => true,
  ) {
    return this.deletePublicCloudAccounts({
      walletId: WALLET.id,
      expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
      expectedCredential: 'encrypted-local-test-credential',
      accounts,
      sourceItemsByAccountId,
      isCurrent,
    });
  }
}

describe('wallet metadata avatar seed sync', () => {
  it('repairs existing indexes without requiring account zero and preserves old payload compatibility', async () => {
    const db = new PublicAccountTestDb();
    db.useRealAvatarHashes = true;
    db.setBackgroundApi({
      servicePrimeCloudSync: { syncManagers: {} },
    } as unknown as IBackgroundApi);
    await db.run([account(2)]);
    const firstEvmAddress = '0xABCDEF1111111111111111111111111111111111';
    const params = {
      walletId: WALLET.id,
      skipSaveLocalSyncItem: true,
      firstEvmAddress,
    };
    await db.setWalletNameAndAvatar(params);
    expect((await db.getWallet({ walletId: WALLET.id })).firstEvmAddress).toBe(
      firstEvmAddress.toLowerCase(),
    );
    const index = db.stores
      .get(ELocalDBStoreNames.IndexedAccount)
      ?.get('hd-1--2');
    expect(index).toMatchObject({
      idHash: await db.buildIndexedAccountIdHash({
        firstEvmAddress: firstEvmAddress.toLowerCase(),
        indexedAccountId: 'hd-1--2',
        index: 2,
        useSynchronousHash: true,
      }),
    });
    await db.setWalletNameAndAvatar({ ...params, firstEvmAddress: undefined });
    await db.setWalletNameAndAvatar({
      ...params,
      firstEvmAddress: '0x2222222222222222222222222222222222222222',
    });
    expect((await db.getWallet({ walletId: WALLET.id })).firstEvmAddress).toBe(
      firstEvmAddress.toLowerCase(),
    );
  });

  it.each([undefined, '', 'not-an-address', '0x123'])(
    'ignores invalid or absent seed %s',
    async (firstEvmAddress) => {
      const db = new PublicAccountTestDb();
      db.setBackgroundApi({
        servicePrimeCloudSync: { syncManagers: {} },
      } as unknown as IBackgroundApi);
      await db.setWalletNameAndAvatar({
        walletId: WALLET.id,
        skipSaveLocalSyncItem: true,
        firstEvmAddress,
      });
      expect(
        (await db.getWallet({ walletId: WALLET.id })).firstEvmAddress,
      ).toBeUndefined();
    },
  );
});

describe('LocalDbBase.importPublicCloudAccounts', () => {
  it.each(PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS)(
    '%s public records use real transactional import, delete and index allocation',
    async (impl) => {
      const fixture = (await publicAccountAllChainFixtures()).find(
        (item) => item.impl === impl,
      );
      if (!fixture) throw new OneKeyLocalError('Missing chain fixture');
      const db = new PublicAccountTestDb();
      const target = publicAccountAllChainWallet(
        fixture.kind,
        fixture.kind === 'hd' ? 'hd-1' : 'hw-1',
      );
      if (fixture.kind === 'hardware') {
        target.associatedDevice = 'local-device';
        db.put(ELocalDBStoreNames.Device, {
          id: 'local-device',
          settingsRaw: '{"vendor":"onekey"}',
        });
      }
      db.put(ELocalDBStoreNames.Wallet, target);
      const snapshot = buildPublicAccountSnapshot({
        wallet: publicAccountAllChainWallet(fixture.kind),
        account: fixture.account,
      });
      if (!snapshot) throw new OneKeyLocalError('Missing public snapshot');
      const copied = publicAccountSnapshotToAccount(snapshot, target.id);
      const params = {
        walletId: target.id,
        expectedWallet: {
          ...snapshot.wallet,
          associatedDevice: target.associatedDevice,
          passphraseState: target.passphraseState,
        },
        expectedCredential:
          fixture.kind === 'hd' ? 'encrypted-local-test-credential' : undefined,
        accounts: [copied],
        isCurrent: () => true,
      };
      expect(await db.importPublicCloudAccounts(params)).toMatchObject({
        added: 1,
        conflicts: 0,
        pending: 0,
      });
      expect(await db.importPublicCloudAccounts(params)).toMatchObject({
        added: 0,
        unchanged: 1,
      });
      expect(
        (await db.getWallet({ walletId: target.id })).nextIds?.accountHdIndex,
      ).toBe(1);
      const sourceItemsByAccountId = db.prepareSources([copied]);
      expect(
        await db.deletePublicCloudAccounts({
          ...params,
          sourceItemsByAccountId,
        }),
      ).toMatchObject({ deleted: 1, pending: 0 });
      expect(await db.importPublicCloudAccounts(params)).toMatchObject({
        added: 1,
      });
      const { records } = await db.getRecordsByIds({
        name: ELocalDBStoreNames.Account,
        ids: [copied.id],
      });
      expect(records[0]).toEqual(copied);
      expect(
        (await db.getWallet({ walletId: target.id })).nextIds?.accountHdIndex,
      ).toBe(1);
      expect(
        await db.findHDNextIndexedAccountIndex({ walletId: target.id }),
      ).toBe(1);
    },
  );
  it.each([
    { firstEvmAddress: '0x111', index: 3, expected: '0x111--3' },
    { firstEvmAddress: undefined, index: 3, expected: 'hd-1--3' },
  ])(
    'keeps the existing index hash while using a transaction-safe backend %j',
    async ({ firstEvmAddress, index, expected }) => {
      const db = new PublicAccountTestDb();
      const params = { firstEvmAddress, index, indexedAccountId: 'hd-1--3' };
      const legacy = await LocalDbBase.prototype.buildIndexedAccountIdHash.call(
        db,
        params,
      );
      const synchronous =
        await LocalDbBase.prototype.buildIndexedAccountIdHash.call(db, {
          ...params,
          useSynchronousHash: true,
        });
      expect(synchronous).toBe(legacy);
      expect(synchronous).toBe(
        createHash('sha256').update(expected).digest('hex').slice(-42),
      );
    },
  );
  it('inserts missing account and index together without Cloud hooks or events', async () => {
    const db = new PublicAccountTestDb();
    expect(await db.run([account()])).toMatchObject({
      added: 1,
      conflicts: 0,
      pending: 0,
    });
    expect(db.writes).toEqual([
      ELocalDBStoreNames.IndexedAccount,
      ELocalDBStoreNames.Account,
      ELocalDBStoreNames.Wallet,
      ELocalDBStoreNames.IndexedAccount,
    ]);
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
    ).toMatchObject({ walletId: 'hd-1', index: 0 });
  });

  it('hydrates canonical avatar seed on duplicate replay and repairs earlier indexes without renaming them', async () => {
    const db = new PublicAccountTestDb();
    db.useRealAvatarHashes = true;
    await db.run([account(4), account(5)]);
    db.put(ELocalDBStoreNames.Account, account(0));
    db.put(ELocalDBStoreNames.IndexedAccount, {
      id: 'hd-1--0',
      walletId: 'hd-1',
      index: 0,
      idHash: 'fallback',
      name: 'My custom account',
    });
    db.put(ELocalDBStoreNames.IndexedAccount, {
      id: 'hd-2--0',
      walletId: 'hd-2',
      index: 0,
      idHash: 'other-wallet-avatar',
      name: 'Other wallet account',
    });
    expect(
      (await db.getWallet({ walletId: WALLET.id })).firstEvmAddress,
    ).toBeUndefined();
    expect(await db.run([account(0)])).toMatchObject({
      added: 0,
      unchanged: 1,
    });
    const wallet = await db.getWallet({ walletId: WALLET.id });
    expect(wallet.firstEvmAddress).toBe(account(0).address.toLowerCase());
    expect(wallet.name).toBe(WALLET.name);
    for (const index of [0, 4, 5]) {
      expect(
        db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get(`hd-1--${index}`),
      ).toMatchObject({
        idHash: createHash('sha256')
          .update(`${account(0).address.toLowerCase()}--${index}`)
          .digest('hex')
          .slice(-42),
      });
    }
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
    ).toMatchObject({ name: 'My custom account' });
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-2--0'),
    ).toMatchObject({ idHash: 'other-wallet-avatar' });
  });

  it('repairs acknowledged account-zero metadata when a later unrelated batch arrives', async () => {
    const db = new PublicAccountTestDb();
    db.useRealAvatarHashes = true;
    db.put(ELocalDBStoreNames.Account, account(0));
    db.put(ELocalDBStoreNames.IndexedAccount, {
      id: 'hd-1--0',
      walletId: WALLET.id,
      index: 0,
      name: 'Keep custom zero',
      idHash: 'old-local-id-avatar',
    });
    const oldSources = db.prepareSources([account(0)], false);
    const oldSource = oldSources.get(account(0).id);
    if (!oldSource) throw new OneKeyLocalError('Missing old source');
    db.put(ELocalDBStoreNames.CloudSyncItem, {
      ...oldSource,
      localSceneUpdated: true,
    });
    const beforeCloud = cloneDeep(
      db.stores.get(ELocalDBStoreNames.CloudSyncItem),
    );
    expect(await db.run([account(7)])).toMatchObject({ added: 1 });
    expect((await db.getWallet({ walletId: WALLET.id })).firstEvmAddress).toBe(
      account(0).address,
    );
    for (const index of [0, 7]) {
      expect(
        db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get(`hd-1--${index}`),
      ).toMatchObject({
        idHash: await db.buildIndexedAccountIdHash({
          firstEvmAddress: account(0).address,
          indexedAccountId: `hd-1--${index}`,
          index,
          useSynchronousHash: true,
        }),
      });
    }
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
    ).toMatchObject({ name: 'Keep custom zero' });
    expect(db.stores.get(ELocalDBStoreNames.CloudSyncItem)).toEqual(
      beforeCloud,
    );
  });

  it('does not infer the avatar seed from a noncanonical or conflicting account', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account(1)]);
    expect(
      (await db.getWallet({ walletId: WALLET.id })).firstEvmAddress,
    ).toBeUndefined();
    db.put(ELocalDBStoreNames.Account, {
      ...account(0),
      address: '0x2222222222222222222222222222222222222222',
    });
    expect(await db.run([account(0)])).toMatchObject({ conflicts: 1 });
    expect(
      (await db.getWallet({ walletId: WALLET.id })).firstEvmAddress,
    ).toBeUndefined();
  });

  it('preserves an established wallet avatar seed even when a canonical snapshot differs', async () => {
    const db = new PublicAccountTestDb();
    const firstEvmAddress = '0x2222222222222222222222222222222222222222';
    db.put(ELocalDBStoreNames.Wallet, {
      ...cloneDeep(WALLET),
      firstEvmAddress,
    });
    await db.run([account(0)]);
    expect((await db.getWallet({ walletId: WALLET.id })).firstEvmAddress).toBe(
      firstEvmAddress,
    );
  });

  it('does not promote a chain label into the universal selector name', async () => {
    const db = new PublicAccountTestDb();
    const chain = { ...account(), name: 'BTC Nested SegWit #1' };
    await db.run([chain]);
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
    ).toMatchObject({
      name: accountUtils.buildIndexedAccountName({ pathIndex: 0 }),
    });
    expect(
      db.stores.get(ELocalDBStoreNames.Account)?.get(chain.id),
    ).toMatchObject({ name: chain.name });
  });

  it.each([
    'new',
    'new-stale-metadata',
    'new-deleted-metadata',
    'polluted',
    'custom',
    'newer-index',
    'newer-metadata',
    'deleted-metadata',
    'custom-chain-label',
  ])('applies authoritative indexed metadata safely: %s', async (mode) => {
    const db = new PublicAccountTestDb();
    const chain = { ...account(), name: 'BTC Nested SegWit #1' };
    const index = {
      id: 'hd-1--0',
      walletId: 'hd-1',
      index: 0,
      idHash: '',
      name: mode === 'custom' ? 'My savings' : chain.name,
    };
    const source: IDBCloudSyncItem = {
      id: 'indexed-metadata',
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      data: 'encrypted-name',
      rawData: '',
      rawKey: '',
      pwdHash: 'public-test-cloud',
      dataTime: 144_000_000,
      isDeleted: false,
      localSceneUpdated: true,
      serverUploaded: true,
    };
    const isNew =
      (mode.startsWith('new-') && !mode.startsWith('newer-')) || mode === 'new';
    if (!isNew) {
      db.put(ELocalDBStoreNames.Account, chain);
      db.put(ELocalDBStoreNames.IndexedAccount, index);
    }
    db.put(ELocalDBStoreNames.CloudSyncItem, source);
    if (mode === 'newer-index')
      db.beforeTransaction = () =>
        db.put(ELocalDBStoreNames.IndexedAccount, {
          ...index,
          name: 'My newer name',
        });
    if (
      [
        'newer-metadata',
        'deleted-metadata',
        'new-stale-metadata',
        'new-deleted-metadata',
      ].includes(mode)
    )
      db.beforeTransaction = () =>
        db.put(ELocalDBStoreNames.CloudSyncItem, {
          ...source,
          dataTime: 144_000_001,
          isDeleted: mode.includes('deleted-metadata'),
        });
    await db.importPublicCloudAccounts({
      walletId: WALLET.id,
      expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
      expectedCredential: 'encrypted-local-test-credential',
      accounts: [chain],
      isCurrent: () => true,
      indexedNames: new Map([
        [
          index.id,
          {
            name: 'Account #1',
            source,
          },
        ],
      ]),
    });
    let expectedName = isNew
      ? accountUtils.buildIndexedAccountName({ pathIndex: 0 })
      : chain.name;
    if (mode === 'new') expectedName = 'Account #1';
    if (mode === 'custom') expectedName = 'My savings';
    if (mode === 'newer-index') expectedName = 'My newer name';
    if (
      ['newer-metadata', 'deleted-metadata', 'custom-chain-label'].includes(
        mode,
      )
    )
      expectedName = chain.name;
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get(index.id),
    ).toMatchObject({ name: expectedName });
    expect(
      db.stores.get(ELocalDBStoreNames.Account)?.get(chain.id),
    ).toMatchObject({ name: chain.name });
  });

  it('is idempotent and keeps the local name', async () => {
    const db = new PublicAccountTestDb();
    db.put(ELocalDBStoreNames.Account, {
      ...account(),
      name: 'Keep local name',
    });
    expect(await db.run([account()])).toMatchObject({ added: 0, unchanged: 1 });
    expect(db.writes).toEqual([ELocalDBStoreNames.Wallet]);
    expect(await db.run([account()])).toMatchObject({ added: 0, unchanged: 1 });
    expect(db.writes).toEqual([ELocalDBStoreNames.Wallet]);
    expect(
      db.stores.get(ELocalDBStoreNames.Account)?.get(account().id),
    ).toMatchObject({ name: 'Keep local name' });
  });

  it('does not overwrite same-path address conflicts', async () => {
    const db = new PublicAccountTestDb();
    const existing = {
      ...account(),
      address: '0x2222222222222222222222222222222222222222',
    };
    db.put(ELocalDBStoreNames.Account, existing);
    expect(await db.run([account()])).toMatchObject({ added: 0, conflicts: 1 });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.get(existing.id)).toEqual(
      existing,
    );
    expect(db.writes).toEqual([]);
  });

  it('advances one wallet counter per batch, preserves other counters, and never decreases it', async () => {
    const db = new PublicAccountTestDb();
    db.put(ELocalDBStoreNames.Wallet, {
      ...WALLET,
      nextIds: { accountGlobalNum: 12 },
    });
    await db.run(
      Array.from({ length: 50 }, (_, index) => account(1500 + index)),
    );
    expect(db.readWallet().nextIds).toEqual({
      accountGlobalNum: 12,
      accountHdIndex: 1550,
    });
    expect(
      db.writes.filter((name) => name === ELocalDBStoreNames.Wallet),
    ).toHaveLength(1);
    db.put(ELocalDBStoreNames.Wallet, {
      ...db.readWallet(),
      nextIds: { accountGlobalNum: 12, accountHdIndex: 9000 },
    });
    await db.run([account(2)]);
    expect(db.readWallet().nextIds).toEqual({
      accountGlobalNum: 12,
      accountHdIndex: 9000,
    });
    expect(
      db.writes.filter((name) => name === ELocalDBStoreNames.Wallet),
    ).toHaveLength(1);
  });

  it('does not advance for conflicting or pending high indexes', async () => {
    const db = new PublicAccountTestDb();
    const conflict = account(5000);
    db.put(ELocalDBStoreNames.Account, {
      ...conflict,
      address: '0x2222222222222222222222222222222222222222',
    });
    expect(await db.run([account(4), conflict])).toMatchObject({
      added: 1,
      conflicts: 1,
    });
    expect(db.readWallet().nextIds.accountHdIndex).toBe(5);
    const stale = db.prepareSources([account(9000)], false, 1);
    db.prepareSources([account(9000)], true, 2);
    expect(
      await db.importPublicCloudAccounts({
        walletId: WALLET.id,
        expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
        expectedCredential: 'encrypted-local-test-credential',
        accounts: [account(9000)],
        sourceItemsByAccountId: stale,
        isCurrent: () => true,
      }),
    ).toMatchObject({ pending: 1 });
    expect(db.readWallet().nextIds.accountHdIndex).toBe(5);
  });

  it('rolls back the counter, accounts and indexes together when cancelled during the wallet write', async () => {
    const db = new PublicAccountTestDb();
    let current = true;
    db.afterWrite = () => {
      if (db.writes.at(-1) === ELocalDBStoreNames.Wallet) current = false;
    };
    expect(await db.run([account(1001)], () => current)).toMatchObject({
      cancelled: true,
      appliedAccountIds: [],
    });
    expect(db.readWallet().nextIds).toEqual({});
    expect(db.stores.get(ELocalDBStoreNames.Account)?.size ?? 0).toBe(0);
    expect(db.stores.get(ELocalDBStoreNames.IndexedAccount)?.size ?? 0).toBe(0);
  });

  it('preserves a shared index name and advances the counter once for multiple chains', async () => {
    const db = new PublicAccountTestDb();
    const evm = account(1500);
    db.put(ELocalDBStoreNames.IndexedAccount, {
      id: evm.indexedAccountId ?? '',
      walletId: WALLET.id,
      index: 1500,
      name: 'Existing shared name',
    });
    const sol: IDBAccount = {
      ...evm,
      id: "hd-1--m/44'/501'/1500'/0'",
      impl: 'sol',
      coinType: '501',
      path: "m/44'/501'/1500'/0'",
      template: "m/44'/501'/$$INDEX$$'/0'",
      address: '11111111111111111111111111111111',
    };
    expect(await db.run([evm, sol])).toMatchObject({ added: 2 });
    expect(db.readWallet().nextIds.accountHdIndex).toBe(1501);
    expect(
      db.stores
        .get(ELocalDBStoreNames.IndexedAccount)
        ?.get(evm.indexedAccountId ?? ''),
    ).toMatchObject({ name: 'Existing shared name' });
    expect(
      db.writes.filter((name) => name === ELocalDBStoreNames.Wallet),
    ).toHaveLength(1);
  });

  it('imports 1000 public accounts and the real next-index wrapper allocates the following free index', async () => {
    const db = new PublicAccountTestDb();
    for (let offset = 0; offset < 1000; offset += 50)
      await db.run(
        Array.from({ length: 50 }, (_, index) => account(offset + index)),
      );
    expect(db.readWallet().nextIds.accountHdIndex).toBe(1000);
    expect(
      db.writes.filter((name) => name === ELocalDBStoreNames.Wallet),
    ).toHaveLength(20);
    db.setBackgroundApi({
      serviceKeylessCloudSync: {
        runWithCloudSyncKeyLock: async <T>(operation: () => Promise<T>) =>
          operation(),
      },
      servicePrimeCloudSync: {
        syncManagers: {
          indexedAccount: {
            buildExistingSyncItemsInfo: async () => ({
              existingSyncItemsInfo: {},
              existingSyncItems: [],
              newSyncItems: [],
            }),
            buildSyncKeyInfo: async ({
              target,
            }: {
              target: { targetId: string };
            }) => ({ key: target.targetId }),
            txWithSyncFlowOfDBRecordCreating: async ({
              runDbTxFn,
            }: {
              runDbTxFn: () => Promise<void>;
            }) => runDbTxFn(),
          },
        },
      },
    } as unknown as IBackgroundApi);
    expect(await db.addHDNextIndexedAccount({ walletId: WALLET.id })).toEqual({
      indexedAccountId: 'hd-1--1000',
    });
    expect(db.readWallet().nextIds.accountHdIndex).toBe(1001);
    expect(db.stores.get(ELocalDBStoreNames.IndexedAccount)?.size).toBe(1001);
  });

  it('repairs a stale counter when acknowledged accounts are replayed unchanged before normal creation', async () => {
    const db = new PublicAccountTestDb();
    const records = [account(0), account(800), account(1500)];
    db.put(ELocalDBStoreNames.Wallet, {
      ...WALLET,
      nextIds: { accountHdIndex: 0, accountGlobalNum: 7 },
    });
    for (const record of records) {
      db.put(ELocalDBStoreNames.Account, {
        ...record,
        name: 'Existing local name',
      });
      db.put(ELocalDBStoreNames.IndexedAccount, {
        id: record.indexedAccountId ?? '',
        walletId: WALLET.id,
        index: record.pathIndex,
        idHash: 'existing-public-index-hash',
        name: 'Existing index name',
      });
    }
    const sources = db.prepareSources(records, false);
    for (const source of sources.values()) {
      source.localSceneUpdated = true;
      db.put(ELocalDBStoreNames.CloudSyncItem, { ...source });
    }
    expect(
      await db.importPublicCloudAccounts({
        walletId: WALLET.id,
        expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
        expectedCredential: 'encrypted-local-test-credential',
        accounts: records,
        sourceItemsByAccountId: sources,
        isCurrent: () => true,
      }),
    ).toMatchObject({
      added: 0,
      unchanged: records.length,
      pending: 0,
      conflicts: 0,
    });
    expect(db.readWallet().nextIds).toEqual({
      accountHdIndex: 1501,
      accountGlobalNum: 7,
    });
    expect(db.writes).toEqual([
      ELocalDBStoreNames.Wallet,
      ELocalDBStoreNames.IndexedAccount,
    ]);
    for (const record of records) {
      expect(
        db.stores.get(ELocalDBStoreNames.Account)?.get(record.id),
      ).toMatchObject({ name: 'Existing local name' });
      expect(
        db.stores
          .get(ELocalDBStoreNames.IndexedAccount)
          ?.get(record.indexedAccountId ?? ''),
      ).toMatchObject({ name: 'Existing index name' });
    }
    db.setBackgroundApi({
      serviceKeylessCloudSync: {
        runWithCloudSyncKeyLock: async <T>(operation: () => Promise<T>) =>
          operation(),
      },
      servicePrimeCloudSync: {
        syncManagers: {
          indexedAccount: {
            buildExistingSyncItemsInfo: async () => ({
              existingSyncItemsInfo: {},
              existingSyncItems: [],
              newSyncItems: [],
            }),
            buildSyncKeyInfo: async ({
              target,
            }: {
              target: { targetId: string };
            }) => ({ key: target.targetId }),
            txWithSyncFlowOfDBRecordCreating: async ({
              runDbTxFn,
            }: {
              runDbTxFn: () => Promise<void>;
            }) => runDbTxFn(),
          },
        },
      },
    } as unknown as IBackgroundApi);
    expect(await db.addHDNextIndexedAccount({ walletId: WALLET.id })).toEqual({
      indexedAccountId: 'hd-1--1501',
    });
    expect(db.readWallet().nextIds).toEqual({
      accountHdIndex: 1502,
      accountGlobalNum: 7,
    });
    expect(db.stores.get(ELocalDBStoreNames.IndexedAccount)?.size).toBe(
      records.length + 1,
    );
  });

  it.each(['wallet', 'credential', 'hidden'])(
    'rechecks %s inside the transaction',
    async (change) => {
      const db = new PublicAccountTestDb();
      db.beforeTransaction = () => {
        if (change === 'wallet')
          db.stores.get(ELocalDBStoreNames.Wallet)?.delete(WALLET.id);
        if (change === 'credential')
          db.put(ELocalDBStoreNames.Credential, {
            id: WALLET.id,
            credential: 'changed-test-credential',
          });
        if (change === 'hidden')
          db.put(ELocalDBStoreNames.Wallet, {
            ...WALLET,
            passphraseState: 'hidden-session',
          });
      };
      expect(await db.run([account()])).toMatchObject({ added: 0, pending: 1 });
      expect(db.writes).toEqual([]);
    },
  );

  it('rolls back both record types if the source changes during the transaction', async () => {
    const db = new PublicAccountTestDb();
    let current = true;
    db.afterWrite = () => {
      current = false;
    };
    expect(await db.run([account()], () => current)).toMatchObject({
      added: 0,
      cancelled: true,
    });
    expect(db.stores.get(ELocalDBStoreNames.IndexedAccount)?.size || 0).toBe(0);
    expect(db.stores.get(ELocalDBStoreNames.Account)?.size || 0).toBe(0);
  });

  it('rejects foreign account IDs without creating indexes', async () => {
    const db = new PublicAccountTestDb();
    expect(
      await db.run([{ ...account(), id: "hw-foreign--m/44'/60'/0'/0/0" }]),
    ).toMatchObject({ conflicts: 1, added: 0 });
    expect(db.writes).toEqual([]);
  });

  it('rejects all conflicting candidates for the same missing ID', async () => {
    const db = new PublicAccountTestDb();
    const different = {
      ...account(),
      address: '0x2222222222222222222222222222222222222222',
    };
    expect(await db.run([account(), different])).toMatchObject({
      added: 0,
      conflicts: 2,
      appliedAccountIds: [],
    });
    expect(db.writes).toEqual([]);
  });

  it('does not report rolled-back IDs after an earlier unchanged record', async () => {
    const db = new PublicAccountTestDb();
    db.put(ELocalDBStoreNames.Account, account());
    let current = true;
    db.afterWrite = () => {
      current = false;
    };
    expect(await db.run([account(), account(1)], () => current)).toMatchObject({
      cancelled: true,
      appliedAccountIds: [],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.size).toBe(1);
  });

  it('caps each transaction at 50 records', async () => {
    const db = new PublicAccountTestDb();
    await expect(
      db.run(Array.from({ length: 51 }, (_, index) => account(index))),
    ).rejects.toThrow(OneKeyLocalError);
    expect(db.writes).toEqual([]);
  });

  it('deletes the winning remote account and its unused index while preserving wallet and seed credential', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const beforeWallet = db.stores
      .get(ELocalDBStoreNames.Wallet)
      ?.get(WALLET.id);
    const beforeCredential = db.stores
      .get(ELocalDBStoreNames.Credential)
      ?.get(WALLET.id);
    expect(await db.delete([account()])).toMatchObject({
      deleted: 1,
      added: 0,
      appliedAccountIds: [account().id],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      false,
    );
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.has('hd-1--0'),
    ).toBe(false);
    expect(db.stores.get(ELocalDBStoreNames.Wallet)?.get(WALLET.id)).toBe(
      beforeWallet,
    );
    expect(db.stores.get(ELocalDBStoreNames.Credential)?.get(WALLET.id)).toBe(
      beforeCredential,
    );
  });

  it('retains a shared index and its name while another chain references it', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const sol = {
      ...account(),
      id: "hd-1--m/44'/501'/0'/0'",
      impl: 'sol',
      coinType: '501',
      path: "m/44'/501'/0'/0'",
      template: "m/44'/501'/$$INDEX$$'/0'",
      address: '11111111111111111111111111111111',
    };
    db.put(ELocalDBStoreNames.Account, sol);
    db.put(ELocalDBStoreNames.IndexedAccount, {
      id: 'hd-1--0',
      walletId: 'hd-1',
      index: 0,
      name: 'Keep shared name',
    });
    expect((await db.delete([account()])).deleted).toBe(1);
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
    ).toMatchObject({ name: 'Keep shared name' });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(sol.id)).toBe(true);
    expect((await db.delete([sol])).deleted).toBe(1);
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.has('hd-1--0'),
    ).toBe(false);
  });

  it('makes remote deletion idempotent and rejects same-path different-address data', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const changed = {
      ...account(),
      address: '0x2222222222222222222222222222222222222222',
    };
    expect(await db.delete([changed])).toMatchObject({
      conflicts: 1,
      deleted: 0,
    });
    expect(
      db.stores.get(ELocalDBStoreNames.Account)?.get(account().id),
    ).toEqual(account());
    const sources = db.prepareSources([account()]);
    expect((await db.delete([account()], sources)).deleted).toBe(1);
    expect(await db.delete([account()], sources)).toMatchObject({
      deleted: 0,
      unchanged: 1,
    });
  });

  it('rejects t1 copy or delete after the opposite t2 source has won the local pool', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const deletedAtT1 = db.prepareSources([account()], true, 1);
    db.prepareSources([account()], false, 2);
    expect(await db.delete([account()], deletedAtT1)).toMatchObject({
      pending: 1,
      deleted: 0,
      appliedAccountIds: [],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      true,
    );
    db.stores.get(ELocalDBStoreNames.Account)?.delete(account().id);
    const copyAtT1 = db.prepareSources([account()], false, 1);
    db.prepareSources([account()], true, 2);
    expect(
      await db.importPublicCloudAccounts({
        walletId: WALLET.id,
        expectedWallet: { kind: 'hd', xfp: XFP, hidden: false },
        expectedCredential: 'encrypted-local-test-credential',
        accounts: [account()],
        sourceItemsByAccountId: copyAtT1,
        isCurrent: () => true,
      }),
    ).toMatchObject({ added: 0, pending: 1 });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      false,
    );
  });

  it('rolls back account and index deletion when the source is cancelled', async () => {
    const db = new PublicAccountTestDb();
    await db.run([account()]);
    const sources = db.prepareSources([account()]);
    let current = true;
    db.afterWrite = () => {
      current = false;
    };
    expect(await db.delete([account()], sources, () => current)).toMatchObject({
      cancelled: true,
      deleted: 0,
      appliedAccountIds: [],
    });
    expect(db.stores.get(ELocalDBStoreNames.Account)?.has(account().id)).toBe(
      true,
    );
    expect(
      db.stores.get(ELocalDBStoreNames.IndexedAccount)?.has('hd-1--0'),
    ).toBe(true);
  });

  it.each([undefined, 'My custom index'])(
    'keeps chain labels out of newly created indexed-account names (%s)',
    async (explicitName) => {
      const db = new PublicAccountTestDb();
      const value = { ...account(2), name: 'BTC Nested SegWit #3' };
      const indexedTargets: Array<{ indexedAccount: { name: string } }> = [];
      db.setBackgroundApi({
        serviceKeylessCloudSync: {
          runWithCloudSyncKeyLock: async <T>(operation: () => Promise<T>) =>
            operation(),
        },
        servicePrimeCloudSync: {
          syncManagers: {
            account: {
              getSyncCredential: async () => undefined,
              buildExistingSyncItemsInfo: async () => ({
                existingSyncItems: [],
                newSyncItems: [],
                existingSyncItemsInfo: {},
              }),
              buildSyncItemForExplicitAccountCreation: async () => undefined,
              txWithSyncFlowOfDBRecordCreating: async ({
                runDbTxFn,
              }: {
                runDbTxFn: () => ReturnType<LocalDbBase['addAccountsToWallet']>;
              }) => runDbTxFn(),
            },
            indexedAccount: {
              buildExistingSyncItemsInfo: async ({
                targets,
              }: {
                targets: Array<{ indexedAccount: { name: string } }>;
              }) => {
                indexedTargets.push(...targets);
                return {
                  existingSyncItems: [],
                  newSyncItems: [],
                  existingSyncItemsInfo: {},
                };
              },
            },
          },
        },
      } as unknown as IBackgroundApi);
      await withPublicAccountCreationContext(
        async (publicAccountCreationContext) => {
          await db.addAccountsToWallet({
            walletId: WALLET.id,
            accounts: [value],
            publicAccountCreationContext,
            publicAccountIndexedNames: explicitName
              ? { 2: explicitName }
              : undefined,
            skipEventEmit: true,
          });
        },
      );
      expect(indexedTargets[0].indexedAccount.name).toBe(
        explicitName || 'Account #3',
      );
      expect(
        db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--2'),
      ).toMatchObject({
        name: explicitName || 'Account #3',
      });
      expect(
        db.stores.get(ELocalDBStoreNames.Account)?.get(value.id),
      ).toMatchObject({
        name: 'BTC Nested SegWit #3',
      });
    },
  );

  it.each([
    { alreadyStored: false, alreadySeeded: false },
    { alreadyStored: true, alreadySeeded: false },
    { alreadyStored: true, alreadySeeded: true },
  ])(
    'repairs historical avatars once, then only touched indexes: %j',
    async ({ alreadyStored, alreadySeeded }) => {
      const db = new PublicAccountTestDb();
      if (alreadySeeded)
        db.put(ELocalDBStoreNames.Wallet, {
          ...WALLET,
          firstEvmAddress: account(0).address,
        });
      db.useRealAvatarHashes = true;
      for (const index of [0, 1, 3]) {
        db.put(ELocalDBStoreNames.IndexedAccount, {
          id: `hd-1--${index}`,
          walletId: WALLET.id,
          index,
          name: `Keep ${index}`,
          idHash: 'old-local-id-avatar',
        });
      }
      db.put(ELocalDBStoreNames.IndexedAccount, {
        id: 'hd-other--0',
        walletId: 'hd-other',
        index: 0,
        name: 'Other wallet',
        idHash: 'keep-other-avatar',
      });
      db.setBackgroundApi({
        serviceKeylessCloudSync: {
          runWithCloudSyncKeyLock: async <T>(operation: () => Promise<T>) =>
            operation(),
        },
        servicePrimeCloudSync: {
          syncManagers: {
            account: {
              buildExistingSyncItemsInfo: async () => ({
                existingSyncItems: [],
                newSyncItems: [],
                existingSyncItemsInfo: {},
              }),
              txWithSyncFlowOfDBRecordCreating: async ({
                runDbTxFn,
              }: {
                runDbTxFn: () => ReturnType<LocalDbBase['addAccountsToWallet']>;
              }) => runDbTxFn(),
            },
          },
        },
      } as unknown as IBackgroundApi);
      if (alreadyStored) db.put(ELocalDBStoreNames.Account, account(0));
      if (alreadySeeded) {
        // Fail after avatar writes, then prove a retry still repairs every
        // index rather than treating the rolled-back scan as committed.
        const originalAdd = db.txAddRecords.bind(db);
        const addSpy = jest.spyOn(db, 'txAddRecords');
        addSpy.mockImplementationOnce(async () => {
          throw new OneKeyLocalError('Simulated account write failure');
        });
        await expect(
          db.addAccountsToWallet({
            walletId: WALLET.id,
            accounts: [account(1)],
            skipEventEmit: true,
          }),
        ).rejects.toThrow('Simulated account write failure');
        addSpy.mockImplementation(originalAdd);
      }
      await db.addAccountsToWallet({
        walletId: WALLET.id,
        accounts: alreadyStored ? [account(1)] : [account(1), account(0)],
        skipEventEmit: true,
      });
      expect(
        (await db.getWallet({ walletId: WALLET.id })).firstEvmAddress,
      ).toBe(account(0).address);
      for (const index of [0, 1, 3]) {
        expect(
          db.stores
            .get(ELocalDBStoreNames.IndexedAccount)
            ?.get(`hd-1--${index}`),
        ).toMatchObject({
          name: `Keep ${index}`,
          idHash: await db.buildIndexedAccountIdHash({
            firstEvmAddress: account(0).address,
            index,
            indexedAccountId: `hd-1--${index}`,
            useSynchronousHash: true,
          }),
        });
      }
      expect(
        db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-other--0'),
      ).toMatchObject({ idHash: 'keep-other-avatar' });

      // Once the seed is established, a later chain creation must not scan
      // or rehash the entire wallet, but still heals its legacy index avatar.
      db.put(ELocalDBStoreNames.IndexedAccount, {
        id: 'hd-1--1',
        walletId: WALLET.id,
        index: 1,
        name: 'Keep 1',
        idHash: 'legacy-avatar-after-seed',
      });
      const scanSpy = jest.spyOn(db, 'txGetAllRecords');
      const hashSpy = jest.spyOn(db, 'buildIndexedAccountIdHash');
      await db.addAccountsToWallet({
        walletId: WALLET.id,
        accounts: [account(1)],
        skipEventEmit: true,
      });
      expect(
        scanSpy.mock.calls.filter(
          ([params]) => params.name === ELocalDBStoreNames.IndexedAccount,
        ),
      ).toHaveLength(0);
      expect(hashSpy).toHaveBeenCalledTimes(1);
      expect(hashSpy).toHaveBeenCalledWith({
        firstEvmAddress: account(0).address,
        indexedAccountId: 'hd-1--1',
        index: 1,
        useSynchronousHash: true,
      });
      expect(
        db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--1'),
      ).toMatchObject({
        name: 'Keep 1',
        idHash: await hashSpy.mock.results[0].value,
      });
    },
  );

  it.each([false, true])(
    'restores historical names and indexes atomically even with an orphan chain row (%s)',
    async (hasOrphan) => {
      const db = new PublicAccountTestDb();
      const value = account(1);
      if (hasOrphan) db.put(ELocalDBStoreNames.Account, value);
      const source = db.prepareSources([value]).get(value.id);
      if (!source) throw new OneKeyLocalError('Missing test source');
      const restored = rememberPublicAccountSnapshotWrite(
        {
          ...source,
          isDeleted: false,
          dataTime: 3,
          data: 'fresh-public-test-ciphertext',
          serverUploaded: false,
        },
        source,
      );
      const buildExplicit = jest.fn(async () => ({
        item: restored,
        name: 'Historical custom name',
      }));
      db.setBackgroundApi({
        serviceKeylessCloudSync: {
          runWithCloudSyncKeyLock: async <T>(operation: () => Promise<T>) =>
            operation(),
        },
        servicePrimeCloudSync: {
          syncManagers: {
            account: {
              getSyncCredential: async () => undefined,
              buildExistingSyncItemsInfo: async () => ({
                existingSyncItems: [source],
                newSyncItems: [],
                existingSyncItemsInfo: {},
              }),
              buildSyncItemForExplicitAccountCreation: buildExplicit,
              txWithSyncFlowOfDBRecordCreating: async ({
                tx,
                newSyncItems,
                runDbTxFn,
              }: {
                tx: ILocalDBTransaction;
                newSyncItems: IDBCloudSyncItem[];
                runDbTxFn: () => ReturnType<LocalDbBase['addAccountsToWallet']>;
              }) => {
                await db.txAddAndUpdateSyncItems({
                  tx,
                  items: newSyncItems,
                  skipUploadToServer: true,
                });
                return runDbTxFn();
              },
            },
          },
        },
      } as unknown as IBackgroundApi);
      await withPublicAccountCreationContext(
        async (publicAccountCreationContext) => {
          await db.addAccountsToWallet({
            walletId: WALLET.id,
            accounts: [value],
            publicAccountCreationContext,
            skipEventEmit: true,
          });
        },
      );
      expect(
        db.stores.get(ELocalDBStoreNames.Account)?.get(value.id),
      ).toMatchObject({ name: 'Historical custom name' });
      expect(
        db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--1'),
      ).toMatchObject({ name: 'Historical custom name' });
      expect(
        db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.get(source.id),
      ).toMatchObject({ isDeleted: false, dataTime: 3 });
      expect(buildExplicit).toHaveBeenCalledTimes(1);
    },
  );
});

describe('metadata scene source version guard', () => {
  it.each(
    [
      EPrimeCloudSyncDataType.Wallet,
      EPrimeCloudSyncDataType.IndexedAccount,
    ].flatMap((dataType) =>
      ['rename', 'same-time-replacement', 'deletion', 'removed-source'].map(
        (change) => ({ dataType, change }),
      ),
    ),
  )(
    'does not replace concurrent metadata from a stale $dataType snapshot ($change)',
    async ({ dataType, change }) => {
      const db = new PublicAccountTestDb();
      db.setBackgroundApi({
        servicePrimeCloudSync: { syncManagers: {} },
      } as unknown as IBackgroundApi);
      jest.spyOn(db, 'emitRenameDBAccountsEvent').mockResolvedValue();
      const source: IDBCloudSyncItem = {
        id: 'metadata-source',
        dataType,
        dataTime: 100,
        data: 'old-ciphertext',
        rawData: 'old-payload',
        rawKey: 'metadata-key',
        pwdHash: 'test-credential',
        isDeleted: false,
        localSceneUpdated: false,
        serverUploaded: true,
      };
      db.put(ELocalDBStoreNames.CloudSyncItem, source);
      db.put(ELocalDBStoreNames.IndexedAccount, {
        id: 'hd-1--0',
        walletId: WALLET.id,
        index: 0,
        name: 'Original',
        idHash: 'original-avatar',
      });
      const replacement = {
        ...source,
        dataTime: change === 'same-time-replacement' ? 100 : 101,
        data: 'new-ciphertext',
        isDeleted: change === 'deletion',
        rawData: 'new-payload',
        localSceneUpdated: true,
        serverUploaded: false,
      };
      db.beforeTransaction = () => {
        if (change === 'removed-source')
          db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.delete(source.id);
        else db.put(ELocalDBStoreNames.CloudSyncItem, replacement);
        db.put(ELocalDBStoreNames.Wallet, {
          ...WALLET,
          name: 'Newest local name',
        });
        db.put(ELocalDBStoreNames.IndexedAccount, {
          id: 'hd-1--0',
          walletId: WALLET.id,
          index: 0,
          name: 'Newest local name',
          idHash: 'original-avatar',
        });
      };
      const common = {
        name: 'Stale cloud name',
        skipSaveLocalSyncItem: true,
        cloudSyncSource: source,
      };
      const apply =
        dataType === EPrimeCloudSyncDataType.Wallet
          ? db.setWalletNameAndAvatar({
              ...common,
              walletId: WALLET.id,
              firstEvmAddress: account(0).address,
            })
          : db.setAccountName({ ...common, indexedAccountId: 'hd-1--0' });
      await expect(apply).rejects.toThrow('Cloud sync metadata source changed');
      expect(db.readWallet()).toMatchObject({ name: 'Newest local name' });
      expect(db.readWallet().firstEvmAddress).toBeUndefined();
      expect(
        db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
      ).toMatchObject({ name: 'Newest local name', idHash: 'original-avatar' });
      expect(
        db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.get(source.id),
      ).toEqual(change === 'removed-source' ? undefined : replacement);
      expect(db.writes).toEqual([]);
    },
  );
});

describe('current metadata scene source', () => {
  it.each([
    EPrimeCloudSyncDataType.Wallet,
    EPrimeCloudSyncDataType.IndexedAccount,
  ])(
    'applies a matching %s source after its decrypted cache is populated',
    async (dataType) => {
      const db = new PublicAccountTestDb();
      db.setBackgroundApi({
        servicePrimeCloudSync: { syncManagers: {} },
      } as unknown as IBackgroundApi);
      jest.spyOn(db, 'emitRenameDBAccountsEvent').mockResolvedValue();
      const source: IDBCloudSyncItem = {
        id: 'metadata-source',
        dataType,
        dataTime: 100,
        data: 'ciphertext',
        rawData: undefined,
        rawKey: 'metadata-key',
        pwdHash: 'test-credential',
        isDeleted: false,
        localSceneUpdated: false,
        serverUploaded: true,
      };
      db.put(ELocalDBStoreNames.CloudSyncItem, {
        ...source,
        rawData: 'decrypted-cache',
      });
      db.put(ELocalDBStoreNames.IndexedAccount, {
        id: 'hd-1--0',
        walletId: WALLET.id,
        index: 0,
        name: 'Original',
        idHash: 'original-avatar',
      });
      const common = {
        name: 'Cloud name',
        skipSaveLocalSyncItem: true,
        cloudSyncSource: source,
      };
      if (dataType === EPrimeCloudSyncDataType.Wallet) {
        await db.setWalletNameAndAvatar({ ...common, walletId: WALLET.id });
        expect(db.readWallet().name).toBe('Cloud name');
      } else {
        await db.setAccountName({ ...common, indexedAccountId: 'hd-1--0' });
        expect(
          db.stores.get(ELocalDBStoreNames.IndexedAccount)?.get('hd-1--0'),
        ).toMatchObject({ name: 'Cloud name' });
      }
    },
  );
});

describe('cloud tombstone cleanup source guard', () => {
  it.each([
    'restored',
    'same-time-new-ciphertext',
    'newer-tombstone',
    'unchanged',
  ])('only removes the downloaded tombstone version: %s', async (change) => {
    const db = new PublicAccountTestDb();
    const source: IDBCloudSyncItem = {
      id: 'deleted-wallet',
      dataType: EPrimeCloudSyncDataType.Wallet,
      dataTime: 100,
      data: 'old-ciphertext',
      rawData: 'old-cache',
      rawKey: 'wallet-key',
      pwdHash: 'test-space',
      isDeleted: true,
      localSceneUpdated: false,
      serverUploaded: true,
    };
    const current = {
      ...source,
      localSceneUpdated: true,
      rawData: 'filled-cache',
      ...(change === 'restored' ? { isDeleted: false, dataTime: 101 } : {}),
      ...(change === 'same-time-new-ciphertext'
        ? { data: 'new-ciphertext' }
        : {}),
      ...(change === 'newer-tombstone' ? { dataTime: 101 } : {}),
    };
    db.put(ELocalDBStoreNames.CloudSyncItem, source);
    db.beforeTransaction = () =>
      db.put(ELocalDBStoreNames.CloudSyncItem, current);
    await db.withTransaction(EIndexedDBBucketNames.account, (tx) =>
      db.txRemoveCloudSyncPoolItems({
        tx,
        keys: [source.id],
        expectedItems: [source],
      }),
    );
    expect(
      db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.get(source.id),
    ).toEqual(change === 'unchanged' ? undefined : current);
  });
});

describe('legacy metadata cancellation transaction guard', () => {
  it.each(['entry', 'source-read', 'write'])(
    'rolls back the name and leaves its ACK pending when cancelled at %s',
    async (phase) => {
      const db = new PublicAccountTestDb();
      db.setBackgroundApi({
        servicePrimeCloudSync: { syncManagers: {} },
      } as unknown as IBackgroundApi);
      const emit = jest
        .spyOn(db, 'emitRenameDBAccountsEvent')
        .mockResolvedValue();
      const local = {
        ...account(),
        id: 'watching--60--legacy',
        name: 'Original local name',
      };
      db.put(ELocalDBStoreNames.Account, local);
      const source: IDBCloudSyncItem = {
        id: 'legacy-name',
        dataType: EPrimeCloudSyncDataType.Account,
        dataTime: 100,
        data: 'old-space-ciphertext',
        rawData: '',
        rawKey: 'legacy-key',
        pwdHash: 'old-space',
        isDeleted: false,
        localSceneUpdated: false,
        serverUploaded: true,
      };
      db.put(ELocalDBStoreNames.CloudSyncItem, source);
      let current = true;
      if (phase === 'entry')
        db.beforeTransaction = () => {
          current = false;
        };
      if (phase === 'source-read') {
        const read = db.txGetRecordsByIds.bind(db);
        jest
          .spyOn(db, 'txGetRecordsByIds')
          .mockImplementation(async (params) => {
            const result = await read(params);
            current = false;
            return result;
          });
      }
      if (phase === 'write')
        db.afterWrite = () => {
          current = false;
        };
      await expect(
        db.setAccountName(
          {
            accountId: local.id,
            name: 'Old space name',
            cloudSyncSource: source,
            skipSaveLocalSyncItem: true,
          },
          { isCurrent: () => current },
        ),
      ).rejects.toThrow('Cloud sync metadata replay cancelled');
      expect(db.stores.get(ELocalDBStoreNames.Account)?.get(local.id)).toEqual(
        local,
      );
      expect(
        db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.get(source.id),
      ).toEqual(source);
      expect(emit).not.toHaveBeenCalled();
    },
  );
});

describe('metadata ACK cancellation transaction guard', () => {
  it('rolls back an ACK when the selected operation changes during its write', async () => {
    const db = new PublicAccountTestDb();
    const source: IDBCloudSyncItem = {
      id: 'legacy-name',
      dataType: EPrimeCloudSyncDataType.Account,
      dataTime: 100,
      data: 'old-space-ciphertext',
      rawData: '',
      rawKey: 'legacy-key',
      pwdHash: 'old-space',
      isDeleted: false,
      localSceneUpdated: false,
      serverUploaded: true,
    };
    db.put(ELocalDBStoreNames.CloudSyncItem, source);
    let current = true;
    db.afterWrite = () => {
      current = false;
    };
    await expect(
      db.updateSyncItem({
        ids: [source.id],
        isCurrent: () => current,
        updater: (record) => {
          record.localSceneUpdated = true;
          return record;
        },
      }),
    ).rejects.toThrow('Cloud sync metadata replay cancelled');
    expect(
      db.stores.get(ELocalDBStoreNames.CloudSyncItem)?.get(source.id),
    ).toEqual(source);
  });
});
