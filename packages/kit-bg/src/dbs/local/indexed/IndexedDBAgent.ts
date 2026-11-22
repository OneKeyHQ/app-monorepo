import { isEqual, isNil, isNumber } from 'lodash';

import { HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  LocalDBRecordNotFoundError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IndexedDBObjectStorePromised,
  IndexedDBPromised,
  IndexedDBTransactionPromised,
} from '@onekeyhq/shared/src/IndexedDBPromised';
import dbPerfMonitor from '@onekeyhq/shared/src/utils/debug/dbPerfMonitor';
import { generateUUID, noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import {
  consumeRemoteHardwareTombstonePromotion,
  isProvenSettledRemoteHardwareAccountTombstone,
} from '../../../services/ServicePrimeCloudSync/cloudSyncCheckUtils';
import {
  ALL_LOCAL_DB_STORE_NAMES,
  INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
} from '../consts';
import { LocalDbAgentBase } from '../LocalDbAgentBase';
import { ELocalDBStoreNames } from '../localDBStoreNames';
import { EIndexedDBBucketNames } from '../types';

import indexedUtils from './indexedDBUtils';

import type {
  IIndexedBucketsMap,
  IIndexedDBSchemaMap,
  IIndexedDBStoreName,
  ILocalDBAgent,
  ILocalDBGetAllRecordsParams,
  ILocalDBGetAllRecordsResult,
  ILocalDBGetRecordByIdParams,
  ILocalDBGetRecordByIdResult,
  ILocalDBGetRecordIdsParams,
  ILocalDBGetRecordIdsResult,
  ILocalDBGetRecordsByIdsParams,
  ILocalDBGetRecordsByIdsResult,
  ILocalDBGetRecordsCountParams,
  ILocalDBGetRecordsCountResult,
  ILocalDBRecord,
  ILocalDBRecordPair,
  ILocalDBRecordUpdater,
  ILocalDBTransaction,
  ILocalDBTransactionStores,
  ILocalDBTxAddRecordsParams,
  ILocalDBTxAddRecordsResult,
  ILocalDBTxGetAllRecordsParams,
  ILocalDBTxGetAllRecordsResult,
  ILocalDBTxGetRecordByIdParams,
  ILocalDBTxGetRecordByIdResult,
  ILocalDBTxGetRecordIdsParams,
  ILocalDBTxGetRecordIdsResult,
  ILocalDBTxGetRecordsByIdsParams,
  ILocalDBTxGetRecordsByIdsResult,
  ILocalDBTxGetRecordsCountParams,
  ILocalDBTxRemoveRecordsParams,
  ILocalDBTxUpdateRecordsParams,
  ILocalDBWithTransactionOptions,
  ILocalDBWithTransactionTask,
  IPendingCloudAccountHandoff,
} from '../types';

const LEGACY_CLOUD_ACCOUNT_ARCHIVE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLegacyCloudAccountArchive(value: unknown): boolean {
  if (
    !value ||
    typeof value !== 'object' ||
    'kind' in value ||
    Object.keys(value).length !== 2 ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !LEGACY_CLOUD_ACCOUNT_ARCHIVE_ID.test(value.id) ||
    !('record' in value)
  ) {
    return false;
  }
  const { record } = value;
  return (
    !!record &&
    typeof record === 'object' &&
    'id' in record &&
    typeof record.id === 'string' &&
    !!record.id &&
    'dataType' in record &&
    record.dataType === EPrimeCloudSyncDataType.Account &&
    'data' in record &&
    typeof record.data === 'string' &&
    record.data.length >= 32 &&
    record.data.length % 2 === 0 &&
    /^[0-9a-f]+$/i.test(record.data) &&
    'pwdHash' in record &&
    typeof record.pwdHash === 'string' &&
    !!record.pwdHash &&
    'serverUploaded' in record &&
    record.serverUploaded === true &&
    'localSceneUpdated' in record &&
    record.localSceneUpdated === true &&
    'isDeleted' in record &&
    (record.isDeleted === false ||
      isProvenSettledRemoteHardwareAccountTombstone(record))
  );
}

function isValidPendingCloudAccountArchive(
  value: unknown,
): value is IPendingCloudAccountHandoff {
  if (
    !value ||
    typeof value !== 'object' ||
    !('kind' in value) ||
    value.kind !== 'pending-account-handoff' ||
    Object.keys(value).length !== 4 ||
    !('id' in value) ||
    !('candidate' in value) ||
    !('expectedForeign' in value)
  )
    return false;

  const validCiphertext = (data: unknown) =>
    typeof data === 'string' &&
    data.length >= 32 &&
    data.length % 2 === 0 &&
    /^[0-9a-f]+$/i.test(data);
  const sterileWireFields = (record: object) =>
    Object.keys(record).every((key) =>
      [
        'id',
        'data',
        'dataTime',
        'dataType',
        'pwdHash',
        'isDeleted',
        'localSceneUpdated',
        'serverUploaded',
        'rawData',
        'rawKey',
      ].includes(key),
    );
  const { candidate, expectedForeign } = value;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !('id' in candidate) ||
    typeof candidate.id !== 'string' ||
    !candidate.id ||
    !('pwdHash' in candidate) ||
    typeof candidate.pwdHash !== 'string' ||
    !candidate.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) ||
    !('dataType' in candidate) ||
    candidate.dataType !== EPrimeCloudSyncDataType.Account ||
    !('data' in candidate) ||
    typeof candidate.data !== 'string' ||
    candidate.data.length > 64 * 1024 ||
    !validCiphertext(candidate.data) ||
    !('rawData' in candidate) ||
    candidate.rawData !== '' ||
    !('rawKey' in candidate) ||
    candidate.rawKey !== '' ||
    !sterileWireFields(candidate) ||
    !('dataTime' in candidate) ||
    typeof candidate.dataTime !== 'number' ||
    !Number.isSafeInteger(candidate.dataTime) ||
    candidate.dataTime <= 0 ||
    !('serverUploaded' in candidate) ||
    candidate.serverUploaded !== true ||
    !('localSceneUpdated' in candidate) ||
    candidate.localSceneUpdated !== false ||
    !('isDeleted' in candidate) ||
    typeof candidate.isDeleted !== 'boolean' ||
    !expectedForeign ||
    typeof expectedForeign !== 'object' ||
    !('id' in expectedForeign) ||
    expectedForeign.id !== candidate.id ||
    !('pwdHash' in expectedForeign) ||
    typeof expectedForeign.pwdHash !== 'string' ||
    !expectedForeign.pwdHash ||
    expectedForeign.pwdHash === candidate.pwdHash ||
    !('dataType' in expectedForeign) ||
    expectedForeign.dataType !== EPrimeCloudSyncDataType.Account ||
    !('data' in expectedForeign) ||
    !validCiphertext(expectedForeign.data) ||
    !('rawData' in expectedForeign) ||
    expectedForeign.rawData !== '' ||
    !('rawKey' in expectedForeign) ||
    expectedForeign.rawKey !== '' ||
    !sterileWireFields(expectedForeign) ||
    ('dataTime' in expectedForeign &&
      expectedForeign.dataTime !== undefined &&
      (typeof expectedForeign.dataTime !== 'number' ||
        !Number.isSafeInteger(expectedForeign.dataTime))) ||
    !('serverUploaded' in expectedForeign) ||
    expectedForeign.serverUploaded !== true ||
    !('localSceneUpdated' in expectedForeign) ||
    expectedForeign.localSceneUpdated !== true ||
    !('isDeleted' in expectedForeign) ||
    typeof expectedForeign.isDeleted !== 'boolean' ||
    (expectedForeign.isDeleted &&
      (!expectedForeign.pwdHash.startsWith(
        HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX,
      ) ||
        !('dataTime' in expectedForeign) ||
        typeof expectedForeign.dataTime !== 'number' ||
        !Number.isSafeInteger(expectedForeign.dataTime) ||
        expectedForeign.dataTime <= 0))
  )
    return false;
  try {
    return (
      value.id ===
      `pending-account-handoff:${encodeURIComponent(candidate.pwdHash)}:${encodeURIComponent(candidate.id)}`
    );
  } catch {
    return false;
  }
}

export class IndexedDBAgent extends LocalDbAgentBase implements ILocalDBAgent {
  constructor(buckets: IIndexedBucketsMap) {
    super();
    this.buckets = buckets;
  }

  clearRecords({ name }: { name: ELocalDBStoreNames }): Promise<void> {
    const bucketName = indexedUtils.getBucketNameByStoreName(name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const store = this._getObjectStoreFromTx(tx, name);
        await store.clear();
      },
      // Clearing a store frees space, so it must stay available while the
      // disk-full guard is raised.
      { allowWhenStorageFull: true },
    );
  }

  getIndexedByBucketName(
    bucketName: EIndexedDBBucketNames,
  ): IndexedDBPromised<IIndexedDBSchemaMap> {
    if (!this.buckets) {
      throw new OneKeyLocalError('buckets not initialized');
    }
    const indexed = this.buckets[bucketName];
    if (!indexed) {
      throw new OneKeyLocalError(`indexedDB bucket not found: ${bucketName}`);
    }
    return indexed;
  }

  buckets: IIndexedBucketsMap | undefined;

  txPair:
    | {
        dbTx: IndexedDBTransactionPromised<
          IIndexedDBSchemaMap,
          IIndexedDBStoreName[],
          'readwrite'
        >;
        tx: ILocalDBTransaction;
      }
    | undefined;

  _getObjectStore<T extends ELocalDBStoreNames>(
    tx: IndexedDBTransactionPromised<
      IIndexedDBSchemaMap,
      IIndexedDBStoreName[],
      'readwrite'
    >,
    storeName: T,
    _: IDBTransactionMode,
  ): IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    IIndexedDBStoreName[],
    T,
    'readwrite'
  > {
    const store = tx.objectStore(storeName);
    return store;
  }

  _getOrCreateObjectStore<T extends ELocalDBStoreNames>(
    tx: IndexedDBTransactionPromised<
      IIndexedDBSchemaMap,
      IIndexedDBStoreName[],
      'readwrite'
    >,
    storeName: T,
    mode: IDBTransactionMode,
    indexed: IndexedDBPromised<IIndexedDBSchemaMap>,
  ): IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    IIndexedDBStoreName[],
    T,
    'readwrite'
  > {
    try {
      const store = this._getObjectStore(tx, storeName, mode);
      // const dd = await store.get('');
      return store;
    } catch {
      indexed.createObjectStore(storeName, {
        keyPath: 'id',
      });
      const store = this._getObjectStore(tx, storeName, mode);
      return store;
    }
  }

  async _buildTransactionAndStores({
    bucketName,
    alwaysCreate = true,
    readOnly = false,
    allowWhenStorageFull = false,
  }: {
    bucketName: EIndexedDBBucketNames;
    alwaysCreate: boolean;
    readOnly?: boolean;
    allowWhenStorageFull?: boolean;
  }) {
    // oxlint-disable-next-line @cspell/spellchecker
    // type IDBTransactionMode = "readonly" | "readwrite" | "versionchange";
    const mode: 'readwrite' = readOnly ? ('readonly' as any) : 'readwrite';

    if (!this.txPair || alwaysCreate) {
      const indexed = this.getIndexedByBucketName(bucketName);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const allStoreNames = ALL_LOCAL_DB_STORE_NAMES;

      const storeNames: IIndexedDBStoreName[] =
        indexedUtils.getStoreNamesByBucketName(bucketName);
      const hasCloudAccountArchive =
        bucketName === EIndexedDBBucketNames.account &&
        (await indexed.open()).objectStoreNames.contains(
          INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
        );
      const transactionStores: IIndexedDBStoreName[] = hasCloudAccountArchive
        ? [...storeNames, INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE]
        : storeNames;
      const dbTx = await indexed.createBucketTransaction(
        transactionStores,
        mode,
        { allowWhenStorageFull },
      );
      let contextStore: any;
      let walletStore: any;
      let accountStore: any;
      let accountDerivationStore: any;
      let indexedAccountStore: any;
      let credentialStore: any;
      let deviceStore: any;
      let addressStore: any;
      let cloudSyncItemStore: any;
      let signMessageStore: any;
      let signedTransactionStore: any;
      let connectedSiteStore: any;
      let hardwareHomeScreenStore: any;

      switch (bucketName) {
        // case EIndexedDBBucketNames.cloudSync: {
        //   cloudSyncItemStore = this._getOrCreateObjectStore(
        //     dbTx,
        //     ELocalDBStoreNames.CloudSyncItem,
        //     mode,
        //     indexed,
        //   );
        //   break;
        // }

        case EIndexedDBBucketNames.account:
        case EIndexedDBBucketNames.backupAccount: {
          cloudSyncItemStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.CloudSyncItem,
            mode,
            indexed,
          );

          contextStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Context,
            mode,
            indexed,
          );

          walletStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Wallet,
            mode,
            indexed,
          );

          accountStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Account,
            mode,
            indexed,
          );

          accountDerivationStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.AccountDerivation,
            mode,
            indexed,
          );

          indexedAccountStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.IndexedAccount,
            mode,
            indexed,
          );

          credentialStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Credential,
            mode,
            indexed,
          );

          deviceStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Device,
            mode,
            indexed,
          );

          break;
        }

        case EIndexedDBBucketNames.address: {
          addressStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.Address,
            mode,
            indexed,
          );
          break;
        }

        case EIndexedDBBucketNames.archive: {
          signMessageStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.SignedMessage,
            mode,
            indexed,
          );

          signedTransactionStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.SignedTransaction,
            mode,
            indexed,
          );

          connectedSiteStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.ConnectedSite,
            mode,
            indexed,
          );

          hardwareHomeScreenStore = this._getOrCreateObjectStore(
            dbTx,
            ELocalDBStoreNames.HardwareHomeScreen,
            mode,
            indexed,
          );
          break;
        }

        default: {
          const exhaustiveCheck: never = bucketName;
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          throw new OneKeyLocalError(
            `Unsupported indexedDB bucket name: ${exhaustiveCheck as string}`,
          );
        }
      }

      const tx: ILocalDBTransaction = {
        bucketName,
        ...(hasCloudAccountArchive
          ? {
              desktopWalletLocalMetadata: {
                read: async (id) => {
                  const value = await dbTx
                    .objectStore(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE)
                    .get(id);
                  return value &&
                    'kind' in value &&
                    value.kind === 'wallet-local-metadata' &&
                    value.id === id
                    ? value
                    : undefined;
                },
                write: async (record) => {
                  await dbTx
                    .objectStore(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE)
                    .put(record);
                },
                remove: async (id) => {
                  await dbTx
                    .objectStore(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE)
                    .delete(id);
                },
              },
            }
          : {}),
        ...(hasCloudAccountArchive
          ? {
              pendingCloudAccountHandoffs: {
                read: async (id) => {
                  const value = await dbTx
                    .objectStore(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE)
                    .get(id);
                  return isValidPendingCloudAccountArchive(value)
                    ? value
                    : undefined;
                },
                list: async (prefix) => {
                  const values = await dbTx
                    .objectStore(INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE)
                    .getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
                  return values.filter(isValidPendingCloudAccountArchive);
                },
                write: async (record) => {
                  const archive = dbTx.objectStore(
                    INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
                  );
                  const previous = await archive.get(record.id);
                  if (
                    isValidPendingCloudAccountArchive(record) &&
                    (!previous || isValidPendingCloudAccountArchive(previous))
                  )
                    await archive.put(record);
                },
                remove: async (record) => {
                  const archive = dbTx.objectStore(
                    INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
                  );
                  const current = await archive.get(record.id);
                  if (
                    isValidPendingCloudAccountArchive(current) &&
                    isEqual(current, record)
                  )
                    await archive.delete(record.id);
                },
              },
            }
          : {}),
        ...(hasCloudAccountArchive && !readOnly
          ? {
              cloudAccountArchive: {
                retain: async (record) => {
                  const archive = dbTx.objectStore(
                    INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
                  );
                  await archive.add({ id: generateUUID(), record });
                },
                clearArchivedRows: async () => {
                  const archive = dbTx.objectStore(
                    INDEXED_CLOUD_ACCOUNT_ARCHIVE_STORE,
                  );
                  let cursor = await archive.openCursor();
                  while (cursor) {
                    // The archive also houses local-only and future tagged rows.
                    if (
                      isLegacyCloudAccountArchive(cursor.value) ||
                      isValidPendingCloudAccountArchive(cursor.value)
                    ) {
                      await cursor.delete();
                    }
                    cursor = await cursor.continue();
                  }
                },
              },
            }
          : {}),
        stores: {
          [ELocalDBStoreNames.Context]: contextStore,
          [ELocalDBStoreNames.Wallet]: walletStore,
          [ELocalDBStoreNames.IndexedAccount]: indexedAccountStore,
          [ELocalDBStoreNames.Account]: accountStore,
          [ELocalDBStoreNames.AccountDerivation]: accountDerivationStore,
          [ELocalDBStoreNames.Credential]: credentialStore,
          [ELocalDBStoreNames.Device]: deviceStore,
          [ELocalDBStoreNames.Address]: addressStore,
          [ELocalDBStoreNames.SignedMessage]: signMessageStore,
          [ELocalDBStoreNames.SignedTransaction]: signedTransactionStore,
          [ELocalDBStoreNames.ConnectedSite]: connectedSiteStore,
          [ELocalDBStoreNames.CloudSyncItem]: cloudSyncItemStore,
          [ELocalDBStoreNames.HardwareHomeScreen]: hardwareHomeScreenStore,
        },
      };

      this.txPair = {
        dbTx,
        tx,
      };
    }
    return this.txPair;
  }

  _getObjectStoreFromTx<T extends ELocalDBStoreNames>(
    tx: ILocalDBTransaction,
    storeName: T,
  ): ILocalDBTransactionStores[T] {
    const store = tx.stores?.[storeName];
    if (!store) {
      const message = `indexedDB store not found: ${storeName}, check IndexedDBAgent code. bucketName=${tx.bucketName}`;
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        title: 'Error',
        message,
        method: 'error',
      });
      throw new OneKeyLocalError(message);
    }
    return store;
  }

  async _executeUpdateRecord<T extends ELocalDBStoreNames>({
    name,
    updater,
    oldRecord,
    tx,
  }: {
    name: T;
    oldRecord: ILocalDBRecord<T>;
    updater: ILocalDBRecordUpdater<T>;
    tx: ILocalDBTransaction;
  }) {
    if (oldRecord) {
      const store = this._getObjectStoreFromTx(tx, name);
      const priorCloudProof =
        name === ELocalDBStoreNames.CloudSyncItem &&
        'remoteHardwareAccountTombstoneProof' in oldRecord &&
        isProvenSettledRemoteHardwareAccountTombstone(oldRecord)
          ? oldRecord.remoteHardwareAccountTombstoneProof
          : undefined;
      const newRecord = await updater(oldRecord);
      if (
        name === ELocalDBStoreNames.CloudSyncItem &&
        'remoteHardwareAccountTombstoneProof' in newRecord
      ) {
        const minted = consumeRemoteHardwareTombstonePromotion(newRecord);
        // Ordinary updates may merge old optional fields. Only the authenticated
        // handoff can mint a proof; invalidated proof cannot be reintroduced.
        if (
          !isProvenSettledRemoteHardwareAccountTombstone(newRecord) ||
          (!minted &&
            newRecord.remoteHardwareAccountTombstoneProof !== priorCloudProof)
        )
          Reflect.deleteProperty(
            newRecord,
            'remoteHardwareAccountTombstoneProof',
          );
      }
      await store.put(newRecord as any);
    }
  }

  // ----------------------------------------------

  async withTransaction<T>(
    bucketName: EIndexedDBBucketNames,
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
  ): Promise<T> {
    noopObject(options);
    const { tx, dbTx } = await this._buildTransactionAndStores({
      bucketName,
      alwaysCreate: true,
      readOnly: options?.readOnly,
      allowWhenStorageFull: options?.allowWhenStorageFull,
    });

    const assertCanCommit = options?.assertCanCommit;
    if (assertCanCommit && typeof dbTx.nativeTx.commit !== 'function') {
      // No operations have been issued: even auto-committing this empty
      // transaction cannot affect the existing confirmed-local fallback.
      assertCanCommit(false);
    }
    try {
      const result = await task(tx);
      if (assertCanCommit) {
        assertCanCommit(true);
        dbTx.commit();
      }
      await dbTx.done;
      return result;
    } catch (error) {
      let abortError: unknown | undefined;
      try {
        // cause: Uncaught (in promise) AbortError: AbortError
        dbTx.abort();
        // Cannot set property error of #<IDBTransaction> which has only a getter
        // dbTx.nativeTx.error = dbTx.nativeTx.error || error;
      } catch (error2) {
        abortError = error2;
      } finally {
        if (process.env.NODE_ENV !== 'production') {
          const isRecordNotFoundError =
            error instanceof LocalDBRecordNotFoundError ||
            errorUtils.isErrorByClassName({
              error,
              className: EOneKeyErrorClassNames.LocalDBRecordNotFoundError,
            });

          if (!isRecordNotFoundError) {
            console.error(error);
            if (abortError) {
              console.error(abortError);
            }
            errorUtils.logCurrentCallStack('localDB.withTransaction Failed');
          }
        }
      }
      if (options?.confirmRollbackOnError) {
        try {
          await dbTx.done;
        } catch {
          throw error;
        }
        throw new OneKeyLocalError(
          'Local wallet transaction rollback could not be confirmed',
        );
      }
      throw error;
    }
  }

  override async getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) =>
        this.txGetRecordsCount({
          ...params,
          tx,
        }),
      {
        readOnly: true,
      },
    );
  }

  async getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const { records } = await this.txGetRecordsByIds({
          ...params,
          tx,
        });
        return { records };
      },
      {
        readOnly: true,
      },
    );
  }

  async getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const { records } = await this.txGetAllRecords({
          ...params,
          tx,
        });
        return { records };
      },
      {
        readOnly: true,
      },
    );
  }

  async getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>> {
    // logLocalDbCall(`getRecordById`, params.name, [params.id]);
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const [record] = await this.txGetRecordById({
          ...params,
          tx,
        });
        return record;
      },
      {
        readOnly: true,
      },
    );
  }

  async getRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult> {
    const bucketName = indexedUtils.getBucketNameByStoreName(params.name);
    return this.withTransaction(
      bucketName,
      async (tx) => {
        const ids = await this.txGetRecordIds({ ...params, tx });
        return ids;
      },
      {
        readOnly: true,
      },
    );
  }

  override async txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult> {
    const { tx: paramsTx, name } = params;
    dbPerfMonitor.logLocalDbCall(`txGetRecordsCount`, name, [true]);
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx(tx, name);
      const count = await store.count();
      return {
        count,
      };
    };
    return fn(paramsTx);
  }

  async txGetRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordsByIdsResult<T>> {
    const { tx: paramsTx, name, ids } = params;
    dbPerfMonitor.logLocalDbCall(`txGetRecordsByIds`, name, [
      `ids_count=${ids ? ids?.length?.toString() : ''}`,
    ]);
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx<T>(tx, name);
      // TODO add query support
      // query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null, count?: number
      let results: unknown[] = [];

      results = await Promise.all(ids.map((id) => store.get(id)));

      const recordPairs: ILocalDBRecordPair<T>[] = [];
      const records: ILocalDBRecord<T>[] = [];

      results.forEach((record) => {
        records.push(record as any);
        recordPairs.push([record as any, null]);
      });
      return {
        recordPairs,
        records,
      };
    };

    return fn(paramsTx);
  }

  async txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>> {
    const { tx: paramsTx, name, limit, offset } = params;
    dbPerfMonitor.logLocalDbCall(`txGetAllRecords`, name, [`ids_count=ALL`]);
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx<T>(tx, name);
      // TODO add query support
      // query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null, count?: number
      let results: unknown[] = [];

      if (isNumber(limit) && isNumber(offset)) {
        const indexStore =
          store as ILocalDBTransactionStores[ELocalDBStoreNames.SignedMessage];
        if (indexStore.indexNames.contains('createdAt')) {
          const cursor = await indexStore
            .index('createdAt')
            .openCursor(null, 'prev');

          let skipped = 0;
          // oxlint-disable-next-line no-unmodified-loop-condition -- IDB cursor is advanced via cursor.continue()
          while (cursor) {
            if (skipped < offset) {
              skipped += 1;
            } else if (results.length <= limit) {
              results.push(cursor.value);
            }
            const data = await cursor.continue();
            if (!data || results.length >= limit) {
              break;
            }
          }
        } else {
          results = await store.getAll();
        }
      } else {
        results = await store.getAll();
      }

      const recordPairs: ILocalDBRecordPair<T>[] = [];
      const records: ILocalDBRecord<T>[] = [];

      results.forEach((record) => {
        records.push(record as any);
        recordPairs.push([record as any, null]);
      });
      return {
        recordPairs,
        records,
      };
    };

    return fn(paramsTx);
  }

  async txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>> {
    const { tx: paramsTx, name, id } = params;
    const fn: (
      tx: ILocalDBTransaction,
    ) => Promise<ILocalDBTxGetRecordByIdResult<T>> = async (
      tx: ILocalDBTransaction,
    ) => {
      const store = this._getObjectStoreFromTx(tx, name);
      dbPerfMonitor.logLocalDbCall(`txGetRecordById`, name, [id]);
      const record = await store.get(id);
      if (!record) {
        const error = new LocalDBRecordNotFoundError(
          `record not found: ${name} ${id}`,
        );
        errorUtils.autoPrintErrorIgnore(error);
        throw error;
      }
      return [record as any, null];
    };
    return fn(paramsTx);
  }

  async txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void> {
    resetUtils.checkNotInResetting();

    const { name, tx, updater } = params;
    const pairs = await this.buildRecordPairsFromIds(params);
    dbPerfMonitor.logLocalDbCall(`txUpdateRecords`, name, [
      `records: ${pairs.length}`,
    ]);
    await Promise.all(
      pairs.map((pair) =>
        this._executeUpdateRecord({
          name,
          tx,
          updater,
          // TODO only update first record?
          oldRecord: pair[0]!,
        }),
      ),
    );
  }

  async txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<ILocalDBTxAddRecordsResult> {
    resetUtils.checkNotInResetting();

    const { name, tx, records, skipIfExists } = params;
    const store = this._getObjectStoreFromTx(tx, name);
    const result: ILocalDBTxAddRecordsResult = {
      added: 0,
      skipped: 0,
      addedIds: [],
    };
    dbPerfMonitor.logLocalDbCall(`txAddRecords`, name, [
      `records: ${records.length}`,
    ]);
    for (const record of records) {
      let shouldAdd = true;
      if (skipIfExists) {
        const existingRecord = await store.get(record.id);
        if (existingRecord) {
          shouldAdd = false;
        }
      }
      if (shouldAdd) {
        if (
          name === ELocalDBStoreNames.CloudSyncItem &&
          'remoteHardwareAccountTombstoneProof' in record
        ) {
          // Only the exact remote handoff replacement of an existing row may mint proof.
          const {
            remoteHardwareAccountTombstoneProof: discardedProof,
            ...withoutProof
          } = record;
          noopObject(discardedProof);
          await store.add(withoutProof as any);
        } else {
          await store.add(record as any);
        }
        result.added += 1;
        result.addedIds.push(record.id);
      } else {
        result.skipped += 1;
      }
    }
    return result;
  }

  async txGetRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordIdsResult> {
    const { tx: paramsTx, name } = params;
    const fn = async (tx: ILocalDBTransaction) => {
      const store = this._getObjectStoreFromTx(tx, name);
      const ids = await store.getAllKeys();
      return ids;
    };
    return fn(paramsTx);
  }

  async txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void> {
    resetUtils.checkNotInResetting();
    const { name, tx } = params;
    const store = this._getObjectStoreFromTx(tx, name);
    const pairs = await this.buildRecordPairsFromIds(params);
    dbPerfMonitor.logLocalDbCall(`txRemoveRecords`, name, [
      `records: ${pairs.length}`,
    ]);
    await Promise.all(
      pairs.map(async (pair) => {
        // TODO only remove first record?
        const recordId = pair[0]?.id;
        if (isNil(recordId)) {
          throw new OneKeyLocalError(
            'dbRemoveRecord ERROR: recordId not found',
          );
        }
        return store.delete(recordId);
      }),
    );
  }
}
