import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  LocalDbOpenError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getPublicAccountSnapshotId,
  publicAccountSnapshotToAccount,
} from '../../services/ServicePrimeCloudSync/publicAccountSnapshot';
import { publicAccountTestSnapshot } from '../../services/ServicePrimeCloudSync/publicAccountSnapshot.test-utils';

import {
  INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  REALM_DB_VERSION,
  supportsIndexedCloudAccountArchive,
} from './consts';
import { IndexedDBAgent } from './indexed/IndexedDBAgent';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBCloudSyncItem, IDBWallet } from './types';

const accountDbName = INDEXED_DB_NAME(EIndexedDBBucketNames.account);
const canonical = { id: 'synthetic-account-row', data: 'canonical-fixture' };
const historical = { id: 'synthetic-history-row', data: 'historical-fixture' };

function open(
  fixture: IDBFactory,
  version: number,
  initialize?: (db: IDBDatabase) => void,
) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = fixture.open(accountDbName, version);
    request.onupgradeneeded = () => initialize?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function read(
  db: IDBDatabase,
  storeName: string,
  id: string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, 'readonly')
      .objectStore(storeName)
      .get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(() => jest.restoreAllMocks());

it.each([
  { platform: 'Desktop', desktop: true, mas: false },
  { platform: 'Desktop MAS', desktop: true, mas: true },
  { platform: 'Web or extension', desktop: false, mas: undefined },
])(
  'uses the shared ordinary indexed schema on $platform',
  async ({ desktop, mas }) => {
    jest.replaceProperty(globalThis, 'indexedDB', new IDBFactory());
    jest.replaceProperty(platformEnv, 'isDesktop', desktop);
    jest.replaceProperty(platformEnv, 'isMas', mas);
    jest.replaceProperty(platformEnv, 'isDev', false);
    expect(INDEXED_DB_VERSION).toBe(21);
    expect(REALM_DB_VERSION).toBe(21);
    expect(supportsIndexedCloudAccountArchive()).toBe(false);
    const agent = await new LocalDbIndexed().readyDb;
    if (!(agent instanceof IndexedDBAgent))
      throw new OneKeyLocalError('Expected IndexedDB agent');
    for (const bucket of Object.values(EIndexedDBBucketNames)) {
      const db = await agent.getIndexedByBucketName(bucket).open();
      expect(db.version).toBe(21);
      expect(
        db.objectStoreNames.contains(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE),
      ).toBe(false);
    }
  },
);

it('opens a previous ordinary bucket at 21 and preserves its existing rows', async () => {
  const fixture = new IDBFactory();
  jest.replaceProperty(globalThis, 'indexedDB', fixture);
  const old = await open(fixture, 20, (db) => {
    db.createObjectStore(ELocalDBStoreNames.CloudSyncItem, {
      keyPath: 'id',
    }).add(canonical);
  });
  old.close();

  const agent = await new LocalDbIndexed().readyDb;
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected IndexedDB agent');
  const now = await agent
    .getIndexedByBucketName(EIndexedDBBucketNames.account)
    .open();
  expect(now.version).toBe(21);
  expect(
    await read(now, ELocalDBStoreNames.CloudSyncItem, canonical.id),
  ).toEqual(canonical);
  expect(
    now.objectStoreNames.contains(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE),
  ).toBe(false);
});

it('refuses to open a higher existing account DB and does not erase canonical or historical rows', async () => {
  const fixture = new IDBFactory();
  jest.replaceProperty(globalThis, 'indexedDB', fixture);
  const existing = await open(fixture, 22, (db) => {
    db.createObjectStore(ELocalDBStoreNames.CloudSyncItem, {
      keyPath: 'id',
    }).add(canonical);
    db.createObjectStore(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, {
      keyPath: 'id',
    }).add(historical);
  });
  existing.close();
  const deleteDatabase = jest.spyOn(fixture, 'deleteDatabase');
  await expect(new LocalDbIndexed().readyDb).rejects.toThrow(LocalDbOpenError);
  expect(deleteDatabase).not.toHaveBeenCalled();
  const unchanged = await open(fixture, 22);
  try {
    expect(unchanged.version).toBe(22);
    expect(
      await read(unchanged, ELocalDBStoreNames.CloudSyncItem, canonical.id),
    ).toEqual(canonical);
    expect(
      await read(unchanged, INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE, historical.id),
    ).toEqual(historical);
  } finally {
    unchanged.close();
  }
});

it('can reopen a verified newer live Account cache on v21 without changing the local account', async () => {
  const fixture = new IDBFactory();
  jest.replaceProperty(globalThis, 'indexedDB', fixture);
  const localDb = new LocalDbIndexed();
  const agent = await localDb.readyDb;
  if (!(agent instanceof IndexedDBAgent))
    throw new OneKeyLocalError('Expected IndexedDB agent');
  const database = await agent
    .getIndexedByBucketName(EIndexedDBBucketNames.account)
    .open();
  const snapshot = publicAccountTestSnapshot(9);
  const wallet: IDBWallet = {
    id: 'hw-1',
    type: 'hw',
    name: 'Existing wallet',
    xfp: snapshot.wallet.xfp,
    associatedDevice: 'verified-device',
    accounts: [],
    nextIds: { accountHdIndex: 10 },
    walletNo: 1,
    backuped: true,
  };
  const incomingAccount = publicAccountSnapshotToAccount(snapshot, wallet.id);
  const localAccount = {
    ...incomingAccount,
    name: 'Local name not overwritten',
  };
  const rawKey = `Account >> ${getPublicAccountSnapshotId(snapshot)}`;
  const older = {
    id: sha512ProSync({ data: rawKey }),
    rawKey,
    rawData: '',
    dataType: EPrimeCloudSyncDataType.Account,
    data: 'ab'.repeat(48),
    dataTime: 10,
    pwdHash: `${HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX}${'a'.repeat(64)}`,
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: true,
  } satisfies IDBCloudSyncItem;
  const incoming = {
    ...older,
    data: 'verified-newer-server-cache-fixture',
    dataTime: 11,
    pwdHash: `${HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX}current-fixture`,
    localSceneUpdated: false,
  };
  const independent = { ...older, id: 'independent-fixture' };
  const rows = {
    [ELocalDBStoreNames.Wallet]: [wallet],
    [ELocalDBStoreNames.Account]: [localAccount],
    [ELocalDBStoreNames.IndexedAccount]: [
      {
        id: incomingAccount.indexedAccountId,
        walletId: wallet.id,
        index: 9,
        name: 'Local index name not overwritten',
      },
    ],
    [ELocalDBStoreNames.Device]: [
      { id: wallet.associatedDevice, settingsRaw: '{"vendor":"onekey"}' },
    ],
    [ELocalDBStoreNames.CloudSyncItem]: [older, independent],
  };
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(Object.keys(rows), 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    for (const [name, records] of Object.entries(rows)) {
      for (const record of records) tx.objectStore(name).put(record);
    }
  });
  expect(
    await localDb.importPublicCloudAccounts({
      walletId: wallet.id,
      expectedWallet: {
        ...snapshot.wallet,
        associatedDevice: wallet.associatedDevice,
      },
      accounts: [incomingAccount],
      sourceItemsByAccountId: new Map([[incomingAccount.id, incoming]]),
      foreignAccountsByWireId: new Map([[older.id, older]]),
      isCurrent: () => true,
    }),
  ).toMatchObject({ unchanged: 1, pending: 0, added: 0 });

  database.close();
  const reopened = await open(fixture, 21);
  try {
    expect(
      reopened.objectStoreNames.contains(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE),
    ).toBe(false);
    expect(
      await read(reopened, ELocalDBStoreNames.CloudSyncItem, older.id),
    ).toMatchObject({
      ...incoming,
      localSceneUpdated: true,
    });
    expect(
      await read(reopened, ELocalDBStoreNames.CloudSyncItem, independent.id),
    ).toEqual(independent);
    expect(
      await read(reopened, ELocalDBStoreNames.Account, localAccount.id),
    ).toEqual(localAccount);
  } finally {
    reopened.close();
  }
});
