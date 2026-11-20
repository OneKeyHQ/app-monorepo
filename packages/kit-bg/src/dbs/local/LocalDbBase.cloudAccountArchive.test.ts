import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICloudSyncCheckServerStatusResult } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

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
  expect(await db.getPendingCloudAccountHandoffs(cloudHash)).toEqual([]);
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
