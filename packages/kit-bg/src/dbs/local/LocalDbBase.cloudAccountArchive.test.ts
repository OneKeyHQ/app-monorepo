import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICloudSyncCheckServerStatusResult } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import {
  buildRemoteHardwareAccountTombstoneProof,
  isProvenSettledRemoteHardwareAccountTombstone,
} from '../../services/ServicePrimeCloudSync/cloudSyncCheckUtils';
import { runCloudSyncReconciliation } from '../../services/ServicePrimeCloudSync/cloudSyncReconciliation';
import { publicAccountSnapshotToAccount } from '../../services/ServicePrimeCloudSync/publicAccountSnapshot';
import {
  PUBLIC_ACCOUNT_TEST_XFP,
  publicAccountTestSnapshot,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.test-utils';

import {
  INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  REALM_DB_VERSION,
  getIndexedLocalDbBucketVersion,
} from './consts';
import { IndexedDBAgent } from './indexed/IndexedDBAgent';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBCloudSyncItem, IDBWallet } from './types';

const cloudHash = 'hw-dek-public-fixture';
const xfp = PUBLIC_ACCOUNT_TEST_XFP;

function rows(index: number) {
  const current: IDBCloudSyncItem = {
    id: `account-archive-test-${index}`,
    data: 'new-synthetic-ciphertext',
    dataTime: 101,
    dataType: EPrimeCloudSyncDataType.Account,
    rawData: 'validated fixture cache (never persisted)',
    rawKey: 'verified-current-raw-key',
    isDeleted: false,
    pwdHash: cloudHash,
    localSceneUpdated: false,
    serverUploaded: true,
  };
  return {
    current,
    old: {
      ...current,
      data: 'unreadable-original-synthetic-ciphertext',
      dataTime: 701,
      rawData: '',
      rawKey: 'old-foreign-key',
      pwdHash: 'foreign-key-fixture',
      localSceneUpdated: true,
    },
  };
}

function wallet(index: number): IDBWallet {
  return {
    id: `hd-${4000 + index}`,
    type: 'hd',
    name: 'Synthetic wallet',
    xfp,
    accounts: [],
    nextIds: {},
    backuped: true,
    walletNo: 4000 + index,
  };
}

async function retainFixture(
  db: LocalDbIndexed,
  target: IDBWallet,
  old: IDBCloudSyncItem,
  includeWallet = true,
) {
  return db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
    if (includeWallet) {
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        records: [target],
      });
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [{ id: target.id, credential: 'synthetic-local-credential' }],
      });
    }
    await db.txAddRecords({
      tx,
      name: ELocalDBStoreNames.CloudSyncItem,
      records: [old],
    });
  });
}

function parameters(
  target: IDBWallet,
  incoming: IDBCloudSyncItem,
  expected: IDBCloudSyncItem,
) {
  const account = publicAccountSnapshotToAccount(
    {
      ...publicAccountTestSnapshot(),
      wallet: { kind: 'hd', xfp, hidden: false },
    },
    target.id,
  );
  return {
    walletId: target.id,
    expectedWallet: { kind: 'hd' as const, xfp, hidden: false },
    expectedCredential: 'synthetic-local-credential',
    accounts: [account],
    sourceItemsByAccountId: new Map([[account.id, incoming]]),
    foreignAccountsByWireId: new Map([[incoming.id, expected]]),
    isCurrent: () => true,
  };
}

async function readArchive(db: LocalDbIndexed, id: string) {
  const agent = await db.readyDb;
  expect(agent).toBeInstanceOf(IndexedDBAgent);
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected test IndexedDB agent');
  const accountDb = agent.getIndexedByBucketName(EIndexedDBBucketNames.account);
  const records = await accountDb.getAll(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE);
  return records.flatMap((entry) =>
    'record' in entry && entry.record.id === id ? [entry.record] : [],
  );
}

beforeEach(() => {
  jest.replaceProperty(platformEnv, 'isDesktop', true);
  jest.replaceProperty(platformEnv, 'isMas', false);
  jest.replaceProperty(platformEnv, 'isDev', false);
  jest.replaceProperty(
    platformEnv,
    'desktopEmbeddedAccountDbCompatibilityVersion',
    22,
  );
});

afterEach(() => jest.restoreAllMocks());

it.each([false, true])('pages after atomic apply (MAS=%s)', async (mas) => {
  platformEnv.isMas = mas;
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
  const writer = new LocalDbIndexed();
  const secondConnection = new LocalDbIndexed();
  const target = wallet(1);
  const { old, current } = rows(1);
  const next = { ...rows(2).current, pwdHash: cloudHash };
  await retainFixture(writer, target, old);
  const apply = parameters(target, current, old);
  const checkSummaries: string[][] = [];
  const controller = new AbortController();
  const upload = jest.fn(async () => ({ uploaded: 0 }));
  const response = (
    item: IDBCloudSyncItem,
    hasMore: boolean,
  ): ICloudSyncCheckServerStatusResult => ({
    diff: [
      {
        key: item.id,
        data: item.data ?? '',
        dataTimestamp: item.dataTime,
        dataType: item.dataType,
        pwdHash: item.pwdHash,
        isDeleted: false,
      },
    ],
    updated: [],
    deleted: [],
    obsoleted: [],
    pwdHash: cloudHash,
    serverTime: Date.now(),
    reconciliation: {
      version: 1,
      diffBeforeLimit: true,
      includesDeleted: true,
      hasMore,
      maxItems: 1,
      maxBytes: 100_000,
    },
  });
  const result = await runCloudSyncReconciliation({
    signal: controller.signal,
    adapter: {
      now: () => Date.now(),
      isCurrent: () => true,
      isBoundedCheckVerified: () => true,
      pause: async () => undefined,
      getFullSummary: async () =>
        (await secondConnection.getAllSyncItems()).syncItems
          .filter((row) => row.pwdHash === cloudHash)
          .map((row) => ({
            key: row.id,
            dataTimestamp: row.dataTime,
            dataType: row.dataType,
          })),
      check: async ({ localData }) => {
        const keys = localData.map((item) => item.key);
        checkSummaries.push(keys);
        return keys.includes(current.id)
          ? response(next, false)
          : response(current, true);
      },
      uploadObsoleted: upload,
      apply: async ({ response: incoming }) => {
        if (incoming.diff[0]?.key === current.id) {
          const accountResult = await writer.importPublicCloudAccounts(apply);
          expect(accountResult.appliedAccountIds).toEqual([
            apply.accounts[0].id,
          ]);
          const canonical = await secondConnection.getSyncItem({
            id: current.id,
          });
          expect(canonical).toMatchObject({
            data: current.data,
            pwdHash: cloudHash,
            rawData: '',
            localSceneUpdated: true,
          });
          expect(await readArchive(secondConnection, current.id)).toEqual([
            old,
          ]);
          return { applied: accountResult.appliedAccountIds.length };
        }
        await writer.addAndUpdateSyncItems({
          items: [next],
          skipUploadToServer: true,
        });
        return { applied: 1 };
      },
    },
  });
  expect(result).toMatchObject({ status: 'complete', unfinished: false });
  expect(checkSummaries).toEqual([[], [current.id]]);
  expect(upload).not.toHaveBeenCalled();
  const { records } = await secondConnection.getRecordsByIds({
    name: ELocalDBStoreNames.Account,
    ids: [apply.accounts[0].id],
  });
  expect(records[0]?.id).toBe(apply.accounts[0].id);
  await expect(
    secondConnection.getSyncItem({ id: next.id }),
  ).resolves.toMatchObject({ data: next.data });
});

it.each([
  'pending',
  'unsent',
  'tombstone',
  'concurrent',
  'missing-wallet',
  'aborted',
] as const)(
  'does not archive, publish or acknowledge an ineligible or interrupted handoff: %s',
  async (scenario) => {
    const index =
      [
        'pending',
        'unsent',
        'tombstone',
        'concurrent',
        'missing-wallet',
        'aborted',
      ].indexOf(scenario) + 10;
    const writer = new LocalDbIndexed();
    const other = new LocalDbIndexed();
    const target = wallet(index);
    const { current, old } = rows(index);
    if (scenario === 'pending') old.pendingPublicAccountDeletionAt = 901;
    if (scenario === 'unsent') old.serverUploaded = false;
    if (scenario === 'tombstone') old.isDeleted = true;
    await retainFixture(writer, target, old, scenario !== 'missing-wallet');
    const input = parameters(target, current, old);
    const competing = { ...old, data: 'concurrent-update' };
    if (scenario === 'concurrent') {
      await other.updateSyncItem({
        ids: [old.id],
        updater: (record) => Object.assign(record, competing),
      });
    }
    if (scenario === 'aborted') {
      const update = writer.txUpdateRecords.bind(writer);
      jest
        .spyOn(writer, 'txUpdateRecords')
        .mockImplementation(async (params) => {
          await update(params);
          if (params.name === ELocalDBStoreNames.CloudSyncItem) {
            throw new OneKeyLocalError(
              'Forced abort after archive and projection writes',
            );
          }
        });
      await expect(writer.importPublicCloudAccounts(input)).rejects.toThrow(
        'Forced abort',
      );
    } else {
      await expect(
        writer.importPublicCloudAccounts(input),
      ).resolves.toMatchObject({ appliedAccountIds: [] });
    }
    expect(await readArchive(other, old.id)).toEqual([]);
    expect(await other.getSyncItem({ id: old.id })).toEqual(
      scenario === 'concurrent' ? competing : old,
    );
    const { records } = await other.getRecordsByIds({
      name: ELocalDBStoreNames.Account,
      ids: [input.accounts[0].id],
    });
    expect(records[0]).toBeFalsy();
  },
);

it('changes only the account IndexedDB version on the supported platforms', () => {
  expect(INDEXED_DB_VERSION).toBe(21);
  expect(REALM_DB_VERSION).toBe(21);
  expect(getIndexedLocalDbBucketVersion(EIndexedDBBucketNames.account)).toBe(
    22,
  );
  expect(getIndexedLocalDbBucketVersion(EIndexedDBBucketNames.address)).toBe(
    21,
  );
  expect(getIndexedLocalDbBucketVersion(EIndexedDBBucketNames.archive)).toBe(
    21,
  );
  expect(
    getIndexedLocalDbBucketVersion(EIndexedDBBucketNames.backupAccount),
  ).toBe(21);
});

it.each([false, true])(
  'old packaged v21 → candidate OTA → v21 rollback preserves the same database (MAS=%s)',
  async (mas) => {
    platformEnv.isMas = mas;
    platformEnv.desktopEmbeddedAccountDbCompatibilityVersion = undefined;
    const fixture = new IDBFactory();
    jest.replaceProperty(globalThis, 'indexedDB', fixture);
    const oldRenderer = new LocalDbIndexed();
    const { old, current } = rows(81);
    await retainFixture(oldRenderer, wallet(81), old);
    const oldAgent = await oldRenderer.readyDb;
    if (!(oldAgent instanceof IndexedDBAgent))
      throw new OneKeyLocalError('Expected test IndexedDB agent');
    const oldAccount = await oldAgent
      .getIndexedByBucketName(EIndexedDBBucketNames.account)
      .open();
    const versionChanged = jest.fn();
    oldAccount.addEventListener('versionchange', versionChanged);
    expect(oldAccount.version).toBe(21);

    // An OTA changes the renderer only. The old shell never supplies the
    // compatibility field, even though the new renderer knows how to use v22.
    const candidate = new LocalDbIndexed();
    const candidateAgent = await candidate.readyDb;
    if (!(candidateAgent instanceof IndexedDBAgent))
      throw new OneKeyLocalError('Expected test IndexedDB agent');
    const candidateAccount = await candidateAgent
      .getIndexedByBucketName(EIndexedDBBucketNames.account)
      .open();
    expect(candidateAccount.version).toBe(21);
    expect(
      candidateAccount.objectStoreNames.contains(
        INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
      ),
    ).toBe(false);
    await expect(candidate.getSyncItem({ id: old.id })).resolves.toEqual(old);
    await retainFixture(candidate, wallet(82), {
      ...current,
      id: 'new-local-test-row',
    });
    expect(versionChanged).not.toHaveBeenCalled();
    oldAccount.close();
    candidateAccount.close();

    // Model an embedded v21 renderer independently of candidate's version logic.
    const fallback = await new Promise<IDBDatabase>((resolve, reject) => {
      const reopen = fixture.open(
        INDEXED_DB_NAME(EIndexedDBBucketNames.account),
        21,
      );
      reopen.onsuccess = () => resolve(reopen.result);
      reopen.onerror = () => reject(reopen.error);
    });
    try {
      expect(fallback.version).toBe(21);
      expect(
        fallback.objectStoreNames.contains(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE),
      ).toBe(false);
      const persisted = await new Promise<unknown>((resolve, reject) => {
        const request = fallback
          .transaction(ELocalDBStoreNames.CloudSyncItem, 'readonly')
          .objectStore(ELocalDBStoreNames.CloudSyncItem)
          .get('new-local-test-row');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(persisted).toMatchObject({
        id: 'new-local-test-row',
        data: current.data,
      });
    } finally {
      fallback.close();
    }
  },
);

it.each([false, true])('upgrades account DB only (MAS=%s)', async (mas) => {
  platformEnv.isMas = mas;
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
  platformEnv.isDesktop = false;
  const legacy = new LocalDbIndexed();
  const { old } = rows(99);
  await retainFixture(legacy, wallet(99), old);
  const legacyAgent = await legacy.readyDb;
  if (!(legacyAgent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected test IndexedDB agent');
  const legacyAccount = legacyAgent.getIndexedByBucketName(
    EIndexedDBBucketNames.account,
  );
  const oldNativeAccount = await legacyAccount.open();
  expect(oldNativeAccount.version).toBe(21);
  expect(
    oldNativeAccount.objectStoreNames.contains(
      INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
    ),
  ).toBe(false);
  const versionChanged = jest.fn();
  oldNativeAccount.addEventListener('versionchange', versionChanged);
  platformEnv.isDesktop = true;

  const upgraded = new LocalDbIndexed();
  const upgradedAgent = await upgraded.readyDb;
  if (!(upgradedAgent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected test IndexedDB agent');
  const upgradedAccount = await upgradedAgent
    .getIndexedByBucketName(EIndexedDBBucketNames.account)
    .open();
  expect(upgradedAccount.version).toBe(22);
  expect(
    upgradedAccount.objectStoreNames.contains(
      INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
    ),
  ).toBe(true);
  expect(versionChanged).toHaveBeenCalledTimes(1);
  await expect(legacyAccount.open()).rejects.toMatchObject({
    name: 'VersionError',
  });
  await expect(upgraded.getSyncItem({ id: old.id })).resolves.toEqual(old);
  expect(await readArchive(upgraded, old.id)).toEqual([]);
  for (const bucket of [
    EIndexedDBBucketNames.address,
    EIndexedDBBucketNames.archive,
    EIndexedDBBucketNames.backupAccount,
  ]) {
    const otherDb = await upgradedAgent.getIndexedByBucketName(bucket).open();
    expect(otherDb.version).toBe(21);
    expect(
      otherDb.objectStoreNames.contains(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE),
    ).toBe(false);
  }
});

it.each([
  { platform: 'Web', desktop: false, mas: false, dev: false },
  { platform: 'native', desktop: false, mas: false, dev: false },
  {
    platform: 'missing Desktop preload',
    desktop: true,
    mas: undefined,
    dev: false,
  },
  { platform: 'development Desktop', desktop: true, mas: false, dev: true },
])(
  'keeps the baseline account schema on $platform',
  ({ desktop, mas, dev }) => {
    platformEnv.isDesktop = desktop;
    platformEnv.isMas = mas;
    platformEnv.isDev = dev;
    expect(getIndexedLocalDbBucketVersion(EIndexedDBBucketNames.account)).toBe(
      21,
    );
  },
);

it('does not create an archive on a future Web account upgrade', async () => {
  const factory = new IDBFactory();
  jest.replaceProperty(globalThis, 'indexedDB', factory);
  platformEnv.isDesktop = false;
  const underlyingOpen = factory.open.bind(factory);
  jest
    .spyOn(factory, 'open')
    .mockImplementation((name, version) =>
      underlyingOpen(
        name,
        name === INDEXED_DB_NAME(EIndexedDBBucketNames.account) &&
          version === 21
          ? 22
          : version,
      ),
    );

  const agent = await new LocalDbIndexed().readyDb;
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected test IndexedDB agent');
  const account = await agent
    .getIndexedByBucketName(EIndexedDBBucketNames.account)
    .open();
  expect(account.version).toBe(22);
  expect(
    account.objectStoreNames.contains(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE),
  ).toBe(false);
});

it.each([false, true])(
  'clears active and archived sync rows, not local wallet metadata (MAS=%s)',
  async (mas) => {
    platformEnv.isMas = mas;
    jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
    const writer = new LocalDbIndexed();
    const reader = new LocalDbIndexed();
    const { current } = rows(20);
    const old = { ...rows(20).old, data: 'a1'.repeat(32) };
    const otherArchive = { ...rows(22).old, data: 'c3'.repeat(32) };
    const pendingRows = rows(23);
    const pendingCandidate = { ...pendingRows.current, data: 'd4'.repeat(32) };
    const pendingForeign = { ...pendingRows.old, data: 'e5'.repeat(32) };
    const pendingId = `pending-account-handoff:${cloudHash}:${pendingCandidate.id}`;
    const badPending = {
      id: 'unrelated-sidecar',
      kind: 'pending-account-handoff' as const,
      candidate: pendingCandidate,
      expectedForeign: pendingForeign,
    };
    const futureTagged = {
      id: '00000000-0000-4000-8000-000000000030',
      kind: 'future-non-cloud-record',
      record: { ...old, id: 'future' },
    };
    const malformed = {
      id: '00000000-0000-4000-8000-000000000031',
      record: { ...old, id: 'malformed', data: 'not-ciphertext' },
    };
    const walletMetadata = {
      id: 'wallet-local-metadata:hd-4020' as const,
      kind: 'wallet-local-metadata' as const,
      walletNo: 4020,
      modifiedAt: 20,

      walletType: 'hd' as const,
      name: 'Synthetic local-only label',
      avatar: { img: 'bear' as const },
    };
    const lock = {
      ...rows(21).current,
      dataType: EPrimeCloudSyncDataType.Lock,
    };
    await retainFixture(writer, wallet(20), current);
    await retainFixture(writer, wallet(23), pendingForeign);
    await writer.storePendingCloudAccountHandoffs({
      candidates: [pendingCandidate],
      expectedForeignById: new Map([[pendingForeign.id, pendingForeign]]),
      pwdHash: cloudHash,
      isCurrent: () => true,
    });
    await writer.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      if (!tx.cloudAccountArchive || !tx.desktopWalletLocalMetadata)
        throw new OneKeyLocalError('Expected test archive and local metadata');
      await tx.cloudAccountArchive.retain(old);
      await tx.cloudAccountArchive.retain(otherArchive);
      await tx.desktopWalletLocalMetadata.write(walletMetadata);
      await writer.txAddRecords({
        tx,
        name: ELocalDBStoreNames.CloudSyncItem,
        records: [lock],
      });
    });

    const agent = await writer.readyDb;
    if (!(agent instanceof IndexedDBAgent))
      throw new OneKeyLocalError('Expected test IndexedDB agent');
    const accountDb = agent.getIndexedByBucketName(
      EIndexedDBBucketNames.account,
    );
    await accountDb.put(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, futureTagged);
    await accountDb.put(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, malformed);
    await accountDb.put(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, badPending);

    // An archive removal fault must also roll back the already-attempted active
    // pool clear, not leave half of the debug operation committed.
    const cursorDelete = jest
      .spyOn(globalThis.IDBCursor.prototype, 'delete')
      .mockImplementationOnce(() => {
        throw new OneKeyLocalError('Injected archive removal failure');
      });
    await expect(writer.clearAllSyncItems()).rejects.toThrow(
      'Injected archive removal failure',
    );
    cursorDelete.mockRestore();
    expect(await reader.getSyncItemSafe({ id: current.id })).toEqual(current);
    expect(await readArchive(reader, old.id)).toEqual([old]);
    expect(
      await accountDb.get(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, pendingId),
    ).toBeDefined();

    await writer.clearAllSyncItems();
    expect(await reader.getAllSyncItems()).toEqual({ syncItems: [] });
    expect(await readArchive(reader, old.id)).toEqual([]);
    expect(await readArchive(reader, otherArchive.id)).toEqual([]);
    expect(
      await accountDb.get(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, pendingId),
    ).toBeUndefined();
    expect(
      await accountDb.get(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, badPending.id),
    ).toEqual(badPending);
    expect(
      await accountDb.get(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, futureTagged.id),
    ).toEqual(futureTagged);
    expect(
      await accountDb.get(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, malformed.id),
    ).toEqual(malformed);
    expect(await reader.getSyncItemSafe({ id: lock.id })).toEqual(lock);
    await reader.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        expect(
          await tx.desktopWalletLocalMetadata?.read(walletMetadata.id),
        ).toEqual(walletMetadata);
      },
      { readOnly: true },
    );
  },
);

it.each([false, true])(
  'applies the exact staged current-source tombstone only, atomically archives, and removes the local Account and unused index (MAS=%s)',
  async (mas) => {
    platformEnv.isMas = mas;
    jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
    const writer = new LocalDbIndexed();
    const reader = new LocalDbIndexed();
    const target = wallet(56);
    const fixtures = rows(56);
    const old = { ...fixtures.old, data: 'bc'.repeat(32) };
    const current = {
      ...fixtures.current,
      data: 'cd'.repeat(32),
      isDeleted: true,
    };
    const input = parameters(target, current, old);
    const [account] = input.accounts;
    await retainFixture(writer, target, old);
    await writer.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await writer.txAddRecords({
        tx,
        name: ELocalDBStoreNames.IndexedAccount,
        records: [
          {
            id: account.indexedAccountId ?? '',
            walletId: target.id,
            index: account.pathIndex ?? 0,
            name: 'Local index',
            idHash: '',
          },
        ],
      });
      await writer.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        records: [account],
      });
    });
    const stage = (candidate: IDBCloudSyncItem) =>
      writer.storePendingCloudAccountHandoffs({
        candidates: [candidate],
        expectedForeignById: new Map([[old.id, old]]),
        pwdHash: cloudHash,
        isCurrent: () => true,
      });
    // An unproven invocation cannot promote a tombstone across spaces.
    expect(await writer.deletePublicCloudAccounts(input)).toMatchObject({
      pending: 1,
      deleted: 0,
    });
    await stage({ ...current, isDeleted: false });
    expect(await writer.getPendingCloudAccountHandoffs(cloudHash)).toHaveLength(
      1,
    );
    expect(await writer.deletePublicCloudAccounts(input)).toMatchObject({
      pending: 1,
      deleted: 0,
    });
    await stage(current);
    expect(await writer.getPendingCloudAccountHandoffs(cloudHash)).toHaveLength(
      1,
    );
    const stale = { ...current, dataTime: (current.dataTime ?? 0) - 1 };
    expect(
      await writer.deletePublicCloudAccounts(parameters(target, stale, old)),
    ).toMatchObject({ pending: 1, deleted: 0 });
    expect(await reader.getSyncItem({ id: old.id })).toEqual(old);
    expect(await readArchive(reader, old.id)).toEqual([]);

    // Read from another connection to model replay after restarting.
    const [staged] = await reader.getPendingCloudAccountHandoffs(cloudHash);
    const apply = () =>
      reader.deletePublicCloudAccounts(
        parameters(target, staged.candidate, staged.expectedForeign),
      );
    const archive = jest
      .spyOn(globalThis.IDBObjectStore.prototype, 'add')
      .mockImplementationOnce(() => {
        throw new OneKeyLocalError('Injected archive failure');
      });
    await expect(apply()).rejects.toThrow('Injected archive failure');
    archive.mockRestore();
    expect(await reader.getSyncItem({ id: old.id })).toEqual(old);
    expect(await readArchive(reader, old.id)).toEqual([]);
    expect(await reader.getPendingCloudAccountHandoffs(cloudHash)).toHaveLength(
      1,
    );
    expect(
      await reader.getAccountSafe({ accountId: account.id }),
    ).toMatchObject({
      id: account.id,
      indexedAccountId: account.indexedAccountId,
    });
    expect(await apply()).toMatchObject({ pending: 0, deleted: 1 });
    expect(await reader.getAccountSafe({ accountId: account.id })).toBeFalsy();
    expect(
      (
        await reader.getRecordsByIds({
          name: ELocalDBStoreNames.IndexedAccount,
          ids: [account.indexedAccountId ?? ''],
        })
      ).records.filter(Boolean),
    ).toEqual([]);
    expect(await readArchive(writer, old.id)).toEqual([old]);
    expect(await writer.getPendingCloudAccountHandoffs(cloudHash)).toEqual([]);
    expect(await writer.getSyncItem({ id: old.id })).toMatchObject({
      isDeleted: true,
      pwdHash: cloudHash,
      data: current.data,
      dataTime: current.dataTime,
      localSceneUpdated: true,
      serverUploaded: true,
      rawData: '',
    });
  },
);

it.each([false, true])(
  'restores a returning hardware space only while the other applied deletion remains current (concurrent change=%s)',
  async (changed) => {
    jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
    const db = new LocalDbIndexed();
    const reader = new LocalDbIndexed();
    const target = wallet(86);
    const { current } = rows(86);
    const sourceA = {
      ...current,
      pwdHash: 'hw-dek-returning-a',
      data: 'ab'.repeat(32),
      rawKey: '',
      rawData: '',
      localSceneUpdated: true,
    };
    const sourceB = {
      ...current,
      data: 'bc'.repeat(32),
      dataTime: 800,
      isDeleted: true,
    };
    const account = parameters(target, sourceB, sourceA).accounts[0];
    await retainFixture(db, target, sourceA);
    await db.withTransaction(EIndexedDBBucketNames.account, async (tx) => {
      await db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Account,
        records: [account],
      });
    });
    const stage = (candidate: IDBCloudSyncItem, expected: IDBCloudSyncItem) =>
      db.storePendingCloudAccountHandoffs({
        candidates: [candidate],
        expectedForeignById: new Map([[expected.id, expected]]),
        pwdHash: candidate.pwdHash,
        isCurrent: () => true,
      });
    await stage(sourceB, sourceA);
    expect(
      await db.deletePublicCloudAccounts(parameters(target, sourceB, sourceA)),
    ).toMatchObject({ pending: 0, deleted: 1 });
    expect(
      await reader.getAccountSafe({ accountId: account.id }),
    ).toBeUndefined();
    const settledB = await reader.getSyncItem({ id: sourceB.id });
    expect(settledB).toMatchObject({
      isDeleted: true,
      localSceneUpdated: true,
      serverUploaded: true,
    });
    const incomingA = {
      ...sourceA,
      data: 'cd'.repeat(32),
      dataTime: 102,
      localSceneUpdated: false,
    };
    expect(
      await db.importPublicCloudAccounts(
        parameters(target, incomingA, settledB),
      ),
    ).toMatchObject({ pending: 1, added: 0 });
    await stage(incomingA, settledB);
    const [pending] = await reader.getPendingCloudAccountHandoffs(
      incomingA.pwdHash,
    );
    expect(pending.expectedForeign).toEqual(settledB);
    const apply = () =>
      db.importPublicCloudAccounts(
        parameters(target, pending.candidate, pending.expectedForeign),
      );
    // Simulate a newer local change after the reader loaded the pending proof.
    const update = (replacement: IDBCloudSyncItem) =>
      reader.withTransaction(EIndexedDBBucketNames.account, (tx) =>
        reader.txUpdateRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [replacement.id],
          updater: (row) => Object.assign(row, replacement),
        }),
      );
    if (changed) {
      const { remoteHardwareAccountTombstoneProof: discarded, ...unmarked } =
        settledB;
      expect(discarded).toBeTruthy();
      const newer = { ...unmarked, dataTime: 801, serverUploaded: false };
      await update(newer);
      expect(
        await reader.getPendingCloudAccountHandoffs(incomingA.pwdHash),
      ).toEqual([]);
      expect(await apply()).toMatchObject({ pending: 1, added: 0 });
      expect(await reader.getSyncItem({ id: settledB.id })).toEqual(newer);
      expect(await readArchive(db, sourceA.id)).toEqual([sourceA]);
      await update(settledB);
      expect(await reader.getSyncItem({ id: settledB.id })).not.toHaveProperty(
        'remoteHardwareAccountTombstoneProof',
      );
      expect(
        await reader.getPendingCloudAccountHandoffs(incomingA.pwdHash),
      ).toEqual([]);
      return;
    }
    expect(await apply()).toMatchObject({ pending: 0, added: 1 });
    expect(
      await reader.getAccountSafe({ accountId: account.id }),
    ).toMatchObject({
      id: account.id,
    });
    expect(await readArchive(db, sourceA.id)).toEqual(
      expect.arrayContaining([sourceA, settledB]),
    );
    await db.clearAllSyncItems();
    expect(await readArchive(db, sourceA.id)).toEqual([]);
  },
);

it.each([
  { remoteHardwareAccountTombstoneProof: undefined },
  { serverUploaded: false },
  { localSceneUpdated: false },
  { pendingPublicAccountDeletionAt: 1050 },
  { pendingPublicAccountDeletionHash: 'public-intent-fixture' },
  { pwdHash: 'unknown-space' },
  { data: '' },
  { data: 'not-ciphertext' },
  { dataTime: 0 },
])(
  'does not hand off over an unproven foreign deletion: %p',
  async (change) => {
    jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
    const db = new LocalDbIndexed();
    const target = wallet(87);
    const { old, current } = rows(87);
    const marked = {
      ...old,
      pwdHash: 'hw-dek-foreign-fixture',
      data: 'ab'.repeat(32),
      isDeleted: true,
    };
    const foreign = {
      ...marked,
      remoteHardwareAccountTombstoneProof:
        buildRemoteHardwareAccountTombstoneProof(marked),
      ...change,
    };
    expect(isProvenSettledRemoteHardwareAccountTombstone(foreign)).toBe(false);
    const incoming = { ...current, data: 'bc'.repeat(32) };
    await retainFixture(db, target, foreign);
    await db.storePendingCloudAccountHandoffs({
      candidates: [incoming],
      expectedForeignById: new Map([[foreign.id, foreign]]),
      pwdHash: incoming.pwdHash,
      isCurrent: () => true,
    });
    expect(await db.getPendingCloudAccountHandoffs(incoming.pwdHash)).toEqual(
      [],
    );
    expect(
      await db.importPublicCloudAccounts(parameters(target, incoming, foreign)),
    ).toMatchObject({ pending: 1, added: 0 });
    expect(await db.getSyncItem({ id: foreign.id })).toMatchObject({
      id: foreign.id,
      data: foreign.data,
      dataTime: foreign.dataTime,
      serverUploaded: foreign.serverUploaded,
      isDeleted: true,
    });
    expect(await db.getSyncItem({ id: foreign.id })).not.toHaveProperty(
      'remoteHardwareAccountTombstoneProof',
    );
    expect(await readArchive(db, foreign.id)).toEqual([]);
  },
);

it('still clears the active v21 pool when the archive is not available', async () => {
  platformEnv.isDesktop = false;
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
  const writer = new LocalDbIndexed();
  const { current } = rows(23);
  await retainFixture(writer, wallet(23), current);
  await writer.clearAllSyncItems();
  expect(await writer.getAllSyncItems()).toEqual({ syncItems: [] });
});

it.each([false, true])(
  'keeps the authenticated handoff off summary until the temporary wallet is kept (MAS=%s)',
  async (mas) => {
    platformEnv.isMas = mas;
    jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
    const writer = new LocalDbIndexed();
    const target = { ...wallet(40), isTemp: true };
    const fixture = rows(40);
    const old = {
      ...fixture.old,
      data: 'b2'.repeat(32),
      rawData: 'legacy-private-cache-fixture',
    };
    const current = { ...fixture.current, data: 'a1'.repeat(32) };
    await retainFixture(writer, target, old);
    const store = (candidate: IDBCloudSyncItem) =>
      writer.storePendingCloudAccountHandoffs({
        candidates: [candidate],
        expectedForeignById: new Map([[old.id, old]]),
        pwdHash: cloudHash,
        isCurrent: () => true,
      });
    await store(current);
    const agent = await writer.readyDb;
    if (!(agent instanceof IndexedDBAgent))
      throw new OneKeyLocalError('Expected test IndexedDB agent');
    const archive = agent.getIndexedByBucketName(EIndexedDBBucketNames.account);
    const archiveEntry = await archive.get(
      INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
      `pending-account-handoff:${cloudHash}:${current.id}`,
    );
    expect(archiveEntry).toMatchObject({
      candidate: { rawData: '', rawKey: '' },
      expectedForeign: { rawData: '', rawKey: '' },
    });
    expect(await writer.getAllSyncItems()).toEqual({ syncItems: [old] });
    expect(
      await writer.getPendingCloudAccountHandoffs('different-space'),
    ).toEqual([]);
    const incoming = parameters(target, current, old);
    expect(await writer.importPublicCloudAccounts(incoming)).toMatchObject({
      pending: 1,
      appliedAccountIds: [],
    });
    expect(await writer.getSyncItem({ id: old.id })).toEqual(old);

    const restarted = new LocalDbIndexed();
    const [pending] = await restarted.getPendingCloudAccountHandoffs(cloudHash);
    expect(pending).toMatchObject({
      candidate: {
        data: current.data,
        rawData: '',
        rawKey: '',
        localSceneUpdated: false,
      },
      expectedForeign: old,
    });
    await restarted.withTransaction(EIndexedDBBucketNames.account, (tx) =>
      restarted.txUpdateWallet({
        tx,
        walletId: target.id,
        updater: (record) => {
          record.isTemp = false;
          return record;
        },
      }),
    );

    const newer = {
      ...current,
      data: 'c3'.repeat(32),
      dataTime: 102,
    };
    await store(newer);
    await store(current);
    expect(await restarted.importPublicCloudAccounts(incoming)).toMatchObject({
      pending: 1,
      appliedAccountIds: [],
    });
    const [retained] =
      await restarted.getPendingCloudAccountHandoffs(cloudHash);
    const replay = parameters(
      target,
      retained.candidate,
      retained.expectedForeign,
    );
    expect(await restarted.importPublicCloudAccounts(replay)).toMatchObject({
      pending: 0,
      appliedAccountIds: [replay.accounts[0].id],
    });
    expect(await restarted.getPendingCloudAccountHandoffs(cloudHash)).toEqual(
      [],
    );
    expect(await restarted.getSyncItem({ id: old.id })).toMatchObject({
      data: newer.data,
      localSceneUpdated: true,
      serverUploaded: true,
      pwdHash: cloudHash,
    });
    expect(await readArchive(restarted, old.id)).toEqual([old]);
  },
);

it('does not replay an earlier live candidate after a verified active-space tombstone', async () => {
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
  const db = new LocalDbIndexed();
  const target = wallet(41);
  const fixture = rows(41);
  const old = { ...fixture.old, data: 'b2'.repeat(32) };
  const current = { ...fixture.current, data: 'a1'.repeat(32) };
  await retainFixture(db, target, old);
  await db.storePendingCloudAccountHandoffs({
    candidates: [current, { ...current, isDeleted: true }, current],
    expectedForeignById: new Map([[old.id, old]]),
    pwdHash: cloudHash,
    isCurrent: () => true,
  });
  expect(await db.getPendingCloudAccountHandoffs(cloudHash)).toMatchObject([
    { candidate: { id: current.id, isDeleted: true }, expectedForeign: old },
  ]);
  expect(
    await db.importPublicCloudAccounts(parameters(target, current, old)),
  ).toMatchObject({
    pending: 1,
    appliedAccountIds: [],
  });
  expect(await db.getSyncItem({ id: old.id })).toEqual(old);
});

it('does not overwrite, replay, or consume an invalid same-key sidecar', async () => {
  jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
  const db = new LocalDbIndexed();
  const target = wallet(42);
  const fixture = rows(42);
  const old = { ...fixture.old, data: 'b2'.repeat(32) };
  const current = { ...fixture.current, data: 'a1'.repeat(32) };
  await retainFixture(db, target, old);
  const agent = await db.readyDb;
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected test IndexedDB agent');
  const archive = agent.getIndexedByBucketName(EIndexedDBBucketNames.account);
  const invalid = {
    id: `pending-account-handoff:${cloudHash}:${current.id}`,
    kind: 'pending-account-handoff' as const,
    candidate: { ...current, data: 'invalid ciphertext' },
    expectedForeign: old,
  };
  await archive.put(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, invalid);
  await db.storePendingCloudAccountHandoffs({
    candidates: [current],
    expectedForeignById: new Map([[old.id, old]]),
    pwdHash: cloudHash,
    isCurrent: () => true,
  });
  expect(await db.getPendingCloudAccountHandoffs(cloudHash)).toEqual([]);
  const verifiedOnlineImport = parameters(target, current, old);
  expect(
    await db.importPublicCloudAccounts(verifiedOnlineImport),
  ).toMatchObject({
    appliedAccountIds: [verifiedOnlineImport.accounts[0].id],
  });
  expect(
    await archive.get(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, invalid.id),
  ).toEqual(invalid);
});
