import 'fake-indexeddb/auto';

import {
  DB_MAIN_CONTEXT_ID,
  DEFAULT_VERIFY_STRING,
  WALLET_TYPE_HD,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { IndexedDBPromised } from '@onekeyhq/shared/src/IndexedDBPromised';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  armAppRecoveryTestFaults,
  consumeAppRecoveryTestFault,
  writeAppResetMarker,
} from '../../services/appResetState';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';

import indexedDBUtils from './indexed/indexedDBUtils';
import { LocalDbIndexed } from './indexed/LocalDbIndexed';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBContext, IDBWallet } from './types';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const bucket = EIndexedDBBucketNames.account;

function walletAt(index: number): IDBWallet {
  return {
    id: `hd-${index}`,
    name: 'Synthetic wallet',
    type: WALLET_TYPE_HD,
    backuped: false,
    nextIds: {},
    accounts: [],
    walletNo: index,
  };
}

async function setup() {
  globalThis.indexedDB = new IDBFactory();
  const db = new LocalDbIndexed();
  const buildSync = jest.fn(async ({ tx }: { tx?: unknown }) => {
    expect(tx).toBeUndefined();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return {
      existingSyncItemsInfo: {},
      existingSyncItems: [],
      newSyncItems: [],
    };
  });
  const manager = {
    buildExistingSyncItemsInfo: buildSync,
    buildSyncKeyInfo: async ({ target }: { target: { targetId: string } }) => ({
      key: target.targetId,
    }),
    txWithSyncFlowOfDBRecordCreating: async ({
      runDbTxFn,
    }: {
      runDbTxFn: () => Promise<void>;
    }) => runDbTxFn(),
  };
  db.setBackgroundApi({
    servicePrimeCloudSync: {
      syncManagers: { wallet: manager, indexedAccount: manager },
    },
  } as unknown as IBackgroundApi);
  const context: IDBContext = {
    id: DB_MAIN_CONTEXT_ID,
    nextHD: 4,
    nextWalletNo: 10,
    verifyString: DEFAULT_VERIFY_STRING,
    localPasswordKdfUpgradedTargetIterations: 0,
    localSecretEnvelopeCredentialMigrated: false,
    localSecretEnvelopeCredentialMigratedTargetVersion: 0,
    localSecretEnvelopeCredentialMigrationLastScannedCredentialId: '',
    backupUUID: 'synthetic-backup',
    nextSignatureMessageId: 1,
    nextSignatureTransactionId: 1,
    nextConnectedSiteId: 1,
  };

  await db.withTransaction(bucket, async (tx) =>
    db.txUpdateContext({
      tx,
      updater: (record) => Object.assign(record, context),
    }),
  );
  jest
    .spyOn(db, 'runPostPasswordVerifiedLazyUpgrade')
    .mockImplementation(() => {});
  jest
    .spyOn(db, 'buildCredentialForLocalSecretEnvelopeWrite')
    .mockResolvedValue({ credential: 'synthetic-credential' });
  const diagnostics = jest.spyOn(defaultLogger.app.storage, 'hdWalletCreation');
  const create = (creationSource: 'create' | 'import' = 'import') =>
    db.createHDWallet({
      password: '',
      rs: 'synthetic-seed-encoding',
      backuped: false,
      walletHash: 'synthetic-hash',
      walletXfp: 'synthetic-xfp',
      creationSource,
    });
  const putWallet = (index: number) =>
    db.withTransaction(bucket, (tx) =>
      db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Wallet,
        records: [walletAt(index)],
      }),
    );
  const putCredential = (index: number) =>
    db.withTransaction(bucket, (tx) =>
      db.txAddRecords({
        tx,
        name: ELocalDBStoreNames.Credential,
        records: [
          { id: `hd-${index}`, credential: 'synthetic-original-credential' },
        ],
      }),
    );
  return { db, buildSync, create, putWallet, putCredential, diagnostics };
}

afterEach(() => jest.restoreAllMocks());

test.each(['free', 'wallet', 'credential'] as const)(
  'creates the first account and advances the actual HD ID when the initial state is %s',
  async (occupied) => {
    const { db, create, putWallet, putCredential, buildSync, diagnostics } =
      await setup();
    if (occupied === 'wallet') await putWallet(4);
    if (occupied === 'credential') await putCredential(4);
    const candidate = occupied === 'free' ? 4 : 5;
    await expect(create()).resolves.toMatchObject({
      wallet: {
        id: `hd-${candidate}`,
        name: `Wallet ${candidate}`,
        walletNo: 10,
      },
      indexedAccount: { walletId: `hd-${candidate}`, index: 0 },
    });
    await expect(db.getContext()).resolves.toMatchObject({
      nextHD: candidate + 1,
      nextWalletNo: 11,
    });
    expect(buildSync).toHaveBeenCalledTimes(2);
    expect(diagnostics.mock.calls.map(([entry]) => entry.event)).toEqual(
      expect.arrayContaining(['transaction_complete', 'operation_committed']),
    );
    if (occupied === 'credential') {
      await expect(
        db.getRecordById({ name: ELocalDBStoreNames.Credential, id: 'hd-4' }),
      ).resolves.toMatchObject({ credential: 'synthetic-original-credential' });
    }
  },
);

test('ignores armed faults outside developer mode and injects only one HD collision', async () => {
  const { db, create, diagnostics } = await setup();
  const readDevSettings = jest.spyOn(devSettingsPersistAtom, 'get');
  const toast = jest.spyOn(appEventBus, 'emit');
  await armAppRecoveryTestFaults(['hdWalletIdOccupied', 'resetRemoteTimeout']);

  readDevSettings.mockResolvedValue({ enabled: false });
  await expect(create('create')).resolves.toMatchObject({
    wallet: { id: 'hd-4' },
  });
  expect(toast).not.toHaveBeenCalledWith(
    EAppEventBusNames.ShowToast,
    expect.objectContaining({ title: expect.stringContaining('开发者模拟') }),
  );

  // The reset-progress marker and the two test faults use separate keys.
  await writeAppResetMarker({
    operationId: 'synthetic-reset',
    preserveBackupRecovery: false,
  });
  await writeAppResetMarker();
  readDevSettings.mockResolvedValue({ enabled: true });
  await expect(create('create')).resolves.toMatchObject({
    wallet: { id: 'hd-6' },
  });
  await expect(db.getContext()).resolves.toMatchObject({ nextHD: 7 });
  expect(
    diagnostics.mock.calls.filter(
      ([entry]) => entry.event === 'developer_fault_injected',
    ),
  ).toHaveLength(1);
  const { records } = await db.getRecordsByIds({
    name: ELocalDBStoreNames.Wallet,
    ids: ['hd-5'],
  });
  expect(records.filter(Boolean)).toHaveLength(0);
  expect(toast).toHaveBeenCalledWith(
    EAppEventBusNames.ShowToast,
    expect.objectContaining({
      method: 'error',
      title: expect.stringContaining('hd-5'),
    }),
  );

  await expect(create('create')).resolves.toMatchObject({
    wallet: { id: 'hd-7' },
  });
  expect(
    diagnostics.mock.calls.filter(
      ([entry]) => entry.event === 'developer_fault_injected',
    ),
  ).toHaveLength(1);
  await expect(consumeAppRecoveryTestFault('resetRemoteTimeout')).resolves.toBe(
    true,
  );
  await expect(consumeAppRecoveryTestFault('resetRemoteTimeout')).resolves.toBe(
    false,
  );
});

test('keeps both occupied candidates and never checks the third ID', async () => {
  const { db, create, putWallet, putCredential, diagnostics } = await setup();
  await putWallet(4);
  await putCredential(5);
  await expect(create()).rejects.toThrow('Both available HD wallet IDs');
  await expect(db.getContext()).resolves.toMatchObject({
    nextHD: 4,
    nextWalletNo: 10,
  });
  expect(
    new Set(
      diagnostics.mock.calls.flatMap(([entry]) =>
        entry.candidate ? [entry.candidate] : [],
      ),
    ),
  ).toEqual(new Set(['hd-4', 'hd-5']));
});

test('rechecks the candidate after concurrent preparation and only switches once', async () => {
  const { db, create, putWallet } = await setup();
  const prepare = db.prepareIndexedAccountsCreationData.bind(db);
  jest
    .spyOn(db, 'prepareIndexedAccountsCreationData')
    .mockImplementationOnce(async (options) => {
      const result = await prepare(options);
      await putWallet(4);
      return result;
    });
  await expect(create()).resolves.toMatchObject({ wallet: { id: 'hd-5' } });
  await expect(db.getContext()).resolves.toMatchObject({ nextHD: 6 });
  await expect(db.getWallet({ walletId: 'hd-4' })).resolves.toMatchObject({
    name: 'Synthetic wallet',
  });
});

test('aborts all writes when the Context update fails', async () => {
  const { db, create, putWallet, diagnostics } = await setup();
  await putWallet(4);
  jest
    .spyOn(db, 'txUpdateContext')
    .mockRejectedValueOnce(
      new DOMException('synthetic failure', 'QuotaExceededError'),
    );
  await expect(create()).rejects.toMatchObject({ name: 'QuotaExceededError' });
  await expect(db.getContext()).resolves.toMatchObject({
    nextHD: 4,
    nextWalletNo: 10,
  });
  const records = await Promise.all([
    db.getRecordsByIds({ name: ELocalDBStoreNames.Wallet, ids: ['hd-5'] }),
    db.getRecordsByIds({ name: ELocalDBStoreNames.Credential, ids: ['hd-5'] }),
    db.getRecordsByIds({
      name: ELocalDBStoreNames.IndexedAccount,
      ids: ['hd-5--0'],
    }),
  ]);
  expect(records.every(({ records: found }) => !found.some(Boolean))).toBe(
    true,
  );
  const events = diagnostics.mock.calls.map(([entry]) => entry.event);
  expect(events).toContain('transaction_abort');
  expect(events).not.toContain('operation_committed');
});

test('records the actual early commit and the failed abort in order', async () => {
  const { db, create, diagnostics } = await setup();
  let signalCommit: (() => void) | undefined;
  const committed = new Promise<void>((resolve) => {
    signalCommit = resolve;
  });
  diagnostics.mockImplementation((entry) => {
    if (entry.event === 'transaction_complete') signalCommit?.();
    return entry;
  });
  const addFirst = db.txAddHDNextIndexedAccount.bind(db);
  jest
    .spyOn(db, 'txAddHDNextIndexedAccount')
    .mockImplementationOnce(async (options) => {
      const result = await addFirst(options);
      await committed;
      return result;
    });
  await expect(create()).rejects.toThrow('rollback could not be confirmed');

  const events = diagnostics.mock.calls.map(([entry]) => entry);
  const commit = events.find((entry) => entry.event === 'transaction_complete');
  const failure = events.find(
    (entry) =>
      entry.event === 'request_failed' && entry.stage === 'Context.put',
  );
  const abort = events.find(
    (entry) => entry.event === 'transaction_abort_failed',
  );
  expect(commit).toBeDefined();
  expect(failure).toMatchObject({ transactionId: commit?.transactionId });
  expect(abort).toMatchObject({ transactionId: commit?.transactionId });
  expect(commit?.sequence).toBeLessThan(failure?.sequence ?? 0);
  expect(failure?.sequence).toBeLessThan(abort?.sequence ?? 0);
  expect(events.map(({ event }) => event)).not.toContain('operation_committed');
  await expect(db.getContext()).resolves.toMatchObject({ nextHD: 4 });
  await expect(db.getWallet({ walletId: 'hd-4' })).resolves.toMatchObject({
    id: 'hd-4',
  });
});

test('waits for a foreign IndexedDB connection to close before reporting deletion', async () => {
  await setup();
  const name = indexedDBUtils.buildDbName(bucket);
  const nativeDb = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  let signalBlocked: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    signalBlocked = resolve;
  });
  let deleted = false;
  const deletion = IndexedDBPromised.deleteDatabase({
    bucketName: bucket,
    name,
    onBlocked: () => signalBlocked?.(),
  }).then(() => {
    deleted = true;
  });
  try {
    await blocked;
    expect(deleted).toBe(false);
  } finally {
    nativeDb.close();
  }
  await deletion;
  expect(deleted).toBe(true);
});
