import { Semaphore, withTimeout } from 'async-mutex';

import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import type { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME } from '@onekeyhq/shared/src/consts/primeConsts';
import { IncorrectMasterPassword } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import cloudSyncUtils from '@onekeyhq/shared/src/utils/cloudSyncUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCredential,
  ICloudSyncDBRecord,
  ICloudSyncDBRecords,
  ICloudSyncKeyInfoMap,
  ICloudSyncKeyInfoWallet,
  ICloudSyncPayloadMap,
  ICloudSyncPayloadWallet,
  ICloudSyncRawDataJson,
  ICloudSyncTargetMap,
  IExistingSyncItemsInfo,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { IS_DB_BUCKET_SUPPORT } from '../../../dbs/local/consts';
import { ELocalDBStoreNames } from '../../../dbs/local/localDBStoreNames';
import {
  EIndexedDBBucketNames,
  type IDBCloudSyncItem,
  type IDBDevice,
  type ILocalDBTransaction,
} from '../../../dbs/local/types';
import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { SemaphoreInterface } from 'async-mutex';

const mutexMap: Partial<Record<EPrimeCloudSyncDataType, SemaphoreInterface>> =
  {};

function getMutexByDataType(
  dataType: EPrimeCloudSyncDataType,
): SemaphoreInterface {
  if (!mutexMap[dataType]) {
    mutexMap[dataType] = withTimeout(new Semaphore(1), 60_000);
  }
  return mutexMap[dataType];
}

export type IWalletNameDeferredObserver = ((
  item: IDBCloudSyncItem,
  reason?: 'canonical-read' | 'canonical-write',
) => void) & { observeCanonicalWrite?: true };

function matchesCloudSyncSceneSource(
  record: {
    data?: string | null;
    dataTime?: number | null;
    dataType: string;
    isDeleted: boolean;
    pwdHash: string;
    rawData?: string | null;
  },
  source: IDBCloudSyncItem,
) {
  return (
    (record.data ?? undefined) === (source.data ?? undefined) &&
    (record.dataTime ?? undefined) === (source.dataTime ?? undefined) &&
    record.dataType === source.dataType &&
    record.isDeleted === source.isDeleted &&
    record.pwdHash === source.pwdHash &&
    (!!source.data ||
      (record.rawData ?? undefined) === (source.rawData ?? undefined))
  );
}

export abstract class CloudSyncFlowManagerBase<
  T extends EPrimeCloudSyncDataType,
  TRecord extends ICloudSyncDBRecord,
> {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

  removeSyncItemIfServerDeleted = true;

  abstract dataType: T;

  abstract isSupportSync(target: ICloudSyncTargetMap[T]): Promise<boolean>;

  abstract buildSyncRawKey(params: {
    target: ICloudSyncTargetMap[T];
  }): Promise<string>;

  abstract buildSyncPayload({
    target,
    callerName,
  }: {
    target: ICloudSyncTargetMap[T];
    callerName?: string;
  }): Promise<ICloudSyncPayloadMap[T]>;

  abstract syncToSceneEachItem(params: {
    isCurrent?: () => boolean;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetMap[T]; // local db target
    payload: ICloudSyncPayloadMap[T]; // decrypted cloud sync payload
  }): Promise<boolean>;

  async syncToSceneEachItemByMutex(params: {
    isCurrent?: () => boolean;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetMap[T]; // local db target
    payload: ICloudSyncPayloadMap[T]; // decrypted cloud sync payload
  }): Promise<boolean> {
    const mutex = getMutexByDataType(params.item.dataType);
    return mutex.runExclusive(async () => {
      if (params.isCurrent && !params.isCurrent()) return false;
      const localDb = this.backgroundApi?.localDb;
      if (localDb && 'getSyncItemSafe' in localDb) {
        const stored = await localDb.getSyncItemSafe({
          id: params.item.id,
        });
        if (!stored || !matchesCloudSyncSceneSource(stored, params.item)) {
          return false;
        }
        if (params.isCurrent && !params.isCurrent()) return false;
      }
      return this.syncToSceneEachItem(params);
    });
  }

  abstract getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadMap[T];
  }): Promise<TRecord | undefined>;

  abstract buildSyncTargetByDBQuery(params: {
    dbRecord: TRecord;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetMap[T]>;

  // for syncToSceneEachItem, fillingSyncItemsMissingDataFromRawData
  // This method should not query the local database, most business scenarios will have new data, the local database is empty. Only account wallet data is excluded, because account wallet does not have new data, only existing data is modified
  abstract buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadMap[T];
  }): Promise<ICloudSyncTargetMap[T] | undefined>;

  async baseBuildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadMap[T];
  }): Promise<ICloudSyncTargetMap[T] | undefined> {
    const { payload } = params;
    const record = await this.getDBRecordBySyncPayload({
      payload,
    });
    if (record) {
      const target = await this.buildSyncTargetByDBQuery({
        dbRecord: record,
      });
      return target;
    }
    return undefined;
  }

  async buildSyncKeyAndPayload({
    target,
    callerName,
  }: {
    target: ICloudSyncTargetMap[T];
    callerName?: string;
  }): Promise<ICloudSyncKeyInfoMap[T]> {
    let rawKey = await this.buildSyncRawKey({ target });
    rawKey = `${this.dataType} >> ${rawKey}`;
    const key = this.rawKeyToHashKey(rawKey);
    const payload = await this.buildSyncPayload({
      target,
      callerName,
    });

    const result: ICloudSyncKeyInfoWallet = {
      key,
      rawKey,
      dataType: this.dataType as EPrimeCloudSyncDataType.Wallet,
      payload: payload as ICloudSyncPayloadWallet,
    };
    return result as unknown as ICloudSyncKeyInfoMap[T];
  }

  async buildSyncPayloadByDBQuery(params: {
    dbRecord: TRecord;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncPayloadMap[T]> {
    const target = await this.buildSyncTargetByDBQuery(params);
    return this.buildSyncPayload({
      target,
    });
  }

  rawKeyToHashKey(rawKey: string): string {
    return sha512ProSync({ data: rawKey });
  }

  async getSyncCredential({
    keylessCloudSyncCredential,
  }: {
    keylessCloudSyncCredential?: IKeylessCloudSyncCredential | null;
  } = {}) {
    return this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe({
      keylessCloudSyncCredential,
    });
  }

  async timeNow() {
    return this.backgroundApi.servicePrimeCloudSync.timeNow();
  }

  async buildSyncKeyInfo({ target }: { target: ICloudSyncTargetMap[T] }) {
    if (!(await this.isSupportSync(target))) {
      return undefined;
    }
    return this.buildSyncKeyAndPayload({
      target,
      callerName: 'buildSyncKeyInfo',
    });
  }

  async buildSyncItemByDBQuery({
    dbRecord,
    allDevices,
    isDeleted,
    dataTime,
    allowHistoricalTime,
    resolveHistoricalDataTime,
    existingDataTime,
    syncCredential,
  }: {
    dbRecord: TRecord;
    allDevices?: IDBDevice[];
    isDeleted: boolean | undefined;
    dataTime: number | undefined;
    allowHistoricalTime?: boolean;
    resolveHistoricalDataTime?: () => number;
    existingDataTime?: number;
    syncCredential: ICloudSyncCredential | undefined;
  }): Promise<IDBCloudSyncItem | undefined> {
    const target = await this.buildSyncTargetByDBQuery({
      dbRecord,
      allDevices,
    });
    return this.buildSyncItem({
      target,
      dataTime,
      allowHistoricalTime,
      resolveHistoricalDataTime,
      existingDataTime,
      syncCredential,
      isDeleted,
    });
  }

  async buildSyncItem({
    target,
    dataTime,
    allowHistoricalTime,
    existingDataTime,
    preserveUndefinedDataTime,
    dataTimeScope,
    syncCredential,
    isDeleted,
  }: {
    target: ICloudSyncTargetMap[T];
    dataTime: number | undefined;
    allowHistoricalTime?: boolean;
    resolveHistoricalDataTime?: () => number;
    existingDataTime?: number;
    preserveUndefinedDataTime?: boolean;
    dataTimeScope?: string;
    syncCredential: ICloudSyncCredential | undefined;
    isDeleted?: boolean;
  }): Promise<IDBCloudSyncItem | undefined> {
    if (!(await this.isSupportSync(target))) {
      return undefined;
    }

    try {
      const { key, rawKey, dataType, payload } =
        await this.buildSyncKeyAndPayload({
          target,
          callerName: 'buildSyncItem',
        });
      const finalDataTime =
        preserveUndefinedDataTime && dataTime === undefined
          ? undefined
          : await this.backgroundApi.servicePrimeCloudSync.getCloudSyncDataTime(
              {
                syncItemKey: dataTimeScope ? `${dataTimeScope}:${key}` : key,
                existingDataTime,
                explicitHistoricalTime: dataTime,
                allowHistoricalTime,
              },
            );
      const item = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
        key,
        rawDataJson: {
          rawKey,
          payload: payload as any,
          dataType: dataType as any,
        },
        syncCredential,
        dataTime: finalDataTime,
      });
      item.localSceneUpdated = true;
      item.serverUploaded = false;
      item.isDeleted = !!isDeleted;
      return item;
    } catch (error) {
      console.error('buildSyncItem error', error);
      return undefined;
    }
  }

  async getSyncItem({
    shouldDecrypt,
    target,
    syncCredential,
  }: {
    shouldDecrypt?: boolean; // decrypt the data to rawDataJson
    target: ICloudSyncTargetMap[T];
    syncCredential: ICloudSyncCredential | undefined;
  }): Promise<IDBCloudSyncItem | undefined> {
    if (!(await this.isSupportSync(target))) {
      return undefined;
    }

    return this.backgroundApi.localDb.withTransaction(
      // EIndexedDBBucketNames.cloudSync,
      EIndexedDBBucketNames.account,
      async (tx) => {
        return this.txGetSyncItem({
          tx,
          shouldDecrypt,
          target,
          syncCredential,
        });
      },
      {
        readOnly: true,
      },
    );
  }

  async txGetSyncItem({
    tx,
    shouldDecrypt,
    target,
    syncCredential,
  }: {
    tx: ILocalDBTransaction;
    shouldDecrypt?: boolean; // decrypt the data to rawDataJson
    target: ICloudSyncTargetMap[T];
    syncCredential: ICloudSyncCredential | undefined;
  }): Promise<IDBCloudSyncItem | undefined> {
    if (!(await this.isSupportSync(target))) {
      return undefined;
    }

    try {
      const { key } = await this.buildSyncKeyAndPayload({
        target,
        callerName: 'txGetSyncItem',
      });
      const [syncItem] = await this.backgroundApi.localDb.txGetRecordById({
        tx,
        id: key,
        name: ELocalDBStoreNames.CloudSyncItem,
      });
      if (shouldDecrypt && syncItem && syncItem.dataType === this.dataType) {
        const { dbItem } = await cloudSyncItemBuilder.decryptSyncItem({
          item: syncItem,
          syncCredential,
        });
        return dbItem;
      }
      return syncItem ?? undefined;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return undefined;
    }
  }

  async buildExistingSyncItemsInfo({
    tx,
    targets,
    useCreateGenesisTime: shouldUseCreateGenesisTime,
    buildSyncItemDataTime,
    onExistingSyncItemsInfo,
  }: {
    tx: ILocalDBTransaction | undefined;
    targets: Array<ICloudSyncTargetMap[T]>;
    useCreateGenesisTime?: (params: {
      target: ICloudSyncTargetMap[T];
    }) => Promise<boolean>;
    buildSyncItemDataTime?: (params: {
      target: ICloudSyncTargetMap[T];
      existingSyncItem: IDBCloudSyncItem | undefined;
    }) => Promise<number | undefined>;
    onExistingSyncItemsInfo: (
      existingSyncItemsInfo: IExistingSyncItemsInfo<T>,
    ) => Promise<void>;
  }) {
    const newSyncItems: IDBCloudSyncItem[] = [];
    const existingSyncItems: IDBCloudSyncItem[] = [];
    const existingSyncItemsInfo: IExistingSyncItemsInfo<T> = {};

    let keylessCloudSyncCredential: IKeylessCloudSyncCredential | null = null;

    if (tx) {
      keylessCloudSyncCredential =
        await this.backgroundApi.localDb.txGetKeylessCloudSyncCredential({
          tx,
        });
    }

    // Asynchronously fetching sync credentials may cause the transaction to commit prematurely, leading to the failure of subsequent database transaction operations.
    // Failed to execute 'get' on 'IDBObjectStore': The transaction has finished.
    const syncCredential = await this.getSyncCredential({
      keylessCloudSyncCredential,
    });
    const canSyncWithoutServer = cloudSyncUtils.canSyncWithoutServer(
      this.dataType,
    );

    const shouldSync =
      canSyncWithoutServer ||
      (await this.backgroundApi.servicePrimeCloudSync.isCloudSyncIsAvailable());

    if (!buildSyncItemDataTime) {
      for (const target of targets) {
        let existingSyncItem: IDBCloudSyncItem | undefined;

        if (shouldSync) {
          if (tx) {
            existingSyncItem = await this.txGetSyncItem({
              tx,
              shouldDecrypt: true,
              target,
              syncCredential,
            });
          } else {
            existingSyncItem = await this.getSyncItem({
              // tx,
              shouldDecrypt: true,
              target,
              syncCredential,
            });
          }
        }

        if (
          existingSyncItem?.rawDataJson &&
          existingSyncItem?.rawDataJson.dataType === this.dataType &&
          existingSyncItem?.rawDataJson.payload
        ) {
          const syncPayload = existingSyncItem?.rawDataJson.payload;

          if (target.targetId) {
            existingSyncItemsInfo[target.targetId] = {
              syncPayload: syncPayload as any,
              syncItem: existingSyncItem,
              target,
            };
          }
          existingSyncItems.push(existingSyncItem);
        } else if (
          canSyncWithoutServer &&
          existingSyncItem &&
          existingSyncItem.rawData
        ) {
          try {
            const rawDataJson = JSON.parse(
              existingSyncItem.rawData,
            ) as ICloudSyncRawDataJson;
            if (rawDataJson.payload) {
              if (target.targetId) {
                existingSyncItemsInfo[target.targetId] = {
                  syncPayload: rawDataJson.payload as any,
                  syncItem: existingSyncItem,
                  target,
                };
              }
              existingSyncItems.push(existingSyncItem);
            }
          } catch (error) {
            console.error('parse rawData error', error);
          }
        } else {
          let dataTime: number | undefined;
          let allowHistoricalTime = false;
          if (shouldUseCreateGenesisTime) {
            if (await shouldUseCreateGenesisTime({ target })) {
              console.log(
                'useCreateGenesisTime PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME',
                PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
              );
              dataTime = PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME;
              allowHistoricalTime = true;
            }
          }
          const newSyncItem = await this.buildSyncItem({
            syncCredential,
            target,
            dataTime,
            allowHistoricalTime,
          });
          if (newSyncItem) {
            newSyncItems.push(newSyncItem);
          }
        }
      }

      await onExistingSyncItemsInfo(existingSyncItemsInfo);

      return {
        existingSyncItemsInfo,
        existingSyncItems,
        newSyncItems,
      };
    }

    const targetSyncStateList: Array<{
      target: ICloudSyncTargetMap[T];
      existingSyncItem: IDBCloudSyncItem | undefined;
    }> = [];

    for (const target of targets) {
      let existingSyncItem: IDBCloudSyncItem | undefined;
      let decryptedSyncItem: IDBCloudSyncItem | undefined;

      if (tx) {
        existingSyncItem = await this.txGetSyncItem({
          tx,
          shouldDecrypt: false,
          target,
          syncCredential,
        });
      } else {
        existingSyncItem = await this.getSyncItem({
          // tx,
          shouldDecrypt: false,
          target,
          syncCredential,
        });
      }

      if (
        shouldSync &&
        existingSyncItem &&
        existingSyncItem.dataType === this.dataType
      ) {
        try {
          const { dbItem } = await cloudSyncItemBuilder.decryptSyncItem({
            item: {
              ...existingSyncItem,
            },
            syncCredential,
          });
          decryptedSyncItem = dbItem;
        } catch (error) {
          errorUtils.autoPrintErrorIgnore(error);
        }
      }

      if (
        existingSyncItem &&
        decryptedSyncItem?.rawDataJson &&
        decryptedSyncItem?.rawDataJson.dataType === this.dataType &&
        decryptedSyncItem?.rawDataJson.payload
      ) {
        const syncPayload = decryptedSyncItem.rawDataJson.payload;

        if (target.targetId) {
          existingSyncItemsInfo[target.targetId] = {
            syncPayload: syncPayload as any,
            syncItem: existingSyncItem,
            target,
          };
        }
      } else if (
        canSyncWithoutServer &&
        existingSyncItem &&
        existingSyncItem.rawData
      ) {
        try {
          const rawDataJson = JSON.parse(
            existingSyncItem.rawData,
          ) as ICloudSyncRawDataJson;
          if (rawDataJson.payload) {
            if (target.targetId) {
              existingSyncItemsInfo[target.targetId] = {
                syncPayload: rawDataJson.payload as any,
                syncItem: existingSyncItem,
                target,
              };
            }
          }
        } catch (error) {
          console.error('parse rawData error', error);
        }
      }

      targetSyncStateList.push({
        target,
        existingSyncItem,
      });
    }

    await onExistingSyncItemsInfo(existingSyncItemsInfo);

    for (const { target, existingSyncItem } of targetSyncStateList) {
      if (existingSyncItem) {
        const updatedDataTime = await buildSyncItemDataTime({
          target,
          existingSyncItem,
        });

        if (updatedDataTime !== undefined) {
          const updatedSyncItem = await this.buildSyncItem({
            syncCredential,
            target,
            dataTime: updatedDataTime,
            existingDataTime: existingSyncItem.dataTime,
            allowHistoricalTime: true,
          });
          if (updatedSyncItem) {
            newSyncItems.push(updatedSyncItem);
          } else {
            existingSyncItems.push(existingSyncItem);
          }
        } else {
          existingSyncItems.push(existingSyncItem);
        }
      } else {
        const dataTime = await buildSyncItemDataTime({
          target,
          existingSyncItem: undefined,
        });

        let historicalDataTime = dataTime;
        let allowHistoricalTime = dataTime !== undefined;
        if (dataTime === undefined && shouldUseCreateGenesisTime) {
          if (await shouldUseCreateGenesisTime({ target })) {
            console.log(
              'useCreateGenesisTime PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME',
              PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
            );
            historicalDataTime = PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME;
            allowHistoricalTime = true;
          }
        }

        const newSyncItem = await this.buildSyncItem({
          syncCredential,
          target,
          dataTime: historicalDataTime,
          allowHistoricalTime,
        });
        if (newSyncItem) {
          newSyncItems.push(newSyncItem);
        }
      }
    }

    return {
      existingSyncItemsInfo,
      existingSyncItems,
      newSyncItems,
    };
  }

  async txWithSyncFlowOfDBRecordCreating<TResult>({
    tx,
    runDbTxFn,
    newSyncItems,
    existingSyncItems,
    skipServerSyncFlow,
  }: {
    tx: ILocalDBTransaction;
    runDbTxFn: (options: { tx: ILocalDBTransaction }) => Promise<TResult>;
    newSyncItems: IDBCloudSyncItem[];
    existingSyncItems: IDBCloudSyncItem[];
    skipServerSyncFlow?: boolean;
  }) {
    // abstract the db sync flow of the create process
    // - get existing sync item
    // - build new sync item
    // - save to db at the end of the transaction
    // - upload to server
    // - start cloud sync flow

    if (newSyncItems.length) {
      if (IS_DB_BUCKET_SUPPORT) {
        // void this.backgroundApi.localDb.addAndUpdateSyncItems({
        //   items: newSyncItems,
        //   // we will startSyncFlowForItems in the end, so skip upload to server here
        //   skipUploadToServer: true,
        // });
        await this.backgroundApi.localDb.txAddAndUpdateSyncItems({
          tx,
          items: newSyncItems,
          // we will startSyncFlowForItems in the end, so skip upload to server here
          skipUploadToServer: true,
        });
      } else {
        await this.backgroundApi.localDb.txAddAndUpdateSyncItems({
          tx,
          items: newSyncItems,
          // we will startSyncFlowForItems in the end, so skip upload to server here
          skipUploadToServer: true,
        });
      }
    }

    const txResult = await runDbTxFn({ tx });

    if (!skipServerSyncFlow) {
      const localItems = [...newSyncItems, ...existingSyncItems].filter(
        Boolean,
      );
      if (localItems.length) {
        if (tx.deferCloudSyncUntilCommit) {
          tx.deferCloudSyncUntilCommit(localItems);
        } else {
          void this.backgroundApi?.servicePrimeCloudSync.startServerSyncFlowForItems(
            {
              localItems,
            },
          );
        }
      }
    }

    return txResult;
  }

  protected async readItemForScene({
    item,
    syncCredential,
    isCurrent,
    localOnly,
  }: {
    item: IDBCloudSyncItem;
    syncCredential: ICloudSyncCredential | undefined;
    isCurrent?: () => boolean;
    localOnly?: boolean;
  }) {
    // Decryption fills the item's plaintext fields in memory.
    const source = { ...item };
    try {
      const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
        item,
        syncCredential,
      });
      return { source, decrypted };
    } catch (error) {
      if (
        !(error instanceof IncorrectMasterPassword) ||
        localOnly ||
        !syncCredential ||
        syncCredential.keylessCredential?.source?.type !== 'hardware' ||
        isCurrent?.() === false
      )
        throw error;
      const replacement =
        await this.backgroundApi.servicePrimeCloudSync.repairUnreadableHardwareSyncItem(
          {
            item: source,
            syncCredential,
            isCurrent,
          },
        );
      if (!replacement || isCurrent?.() === false) throw error;
      const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
        item: { ...replacement },
        syncCredential,
      });
      return { source: replacement, decrypted };
    }
  }

  async syncToScene({
    syncCredential,
    items,
    forceSync,
    isCurrent,
    localOnly,
    onWalletNameHistoryDeferred,
  }: {
    syncCredential: ICloudSyncCredential | undefined;
    items: IDBCloudSyncItem[];
    forceSync?: boolean;
    isCurrent?: () => boolean;
    localOnly?: boolean;
    onWalletNameHistoryDeferred?: IWalletNameDeferredObserver;
  }) {
    if (!items.length) {
      return;
    }
    // if (!syncCredential) {
    //   return;
    // }
    for (const item of items) {
      if (isCurrent && !isCurrent()) return;
      try {
        let shouldSync =
          syncCredential &&
          cloudSyncItemBuilder.canLocalItemSyncToScene({
            item,
            syncCredential,
          });
        if (forceSync) {
          shouldSync = true;
        }
        if (item.dataType === this.dataType && shouldSync) {
          const { source, decrypted: decryptedItem } =
            await this.readItemForScene({
              item,
              syncCredential,
              isCurrent,
              localOnly,
            });
          // Retain the stored acknowledgment fields.
          const { localSceneUpdated, pwdHash, rawData, rawKey } = source;
          // A caller may already have decrypted fields that are not yet stored.
          const wasAlreadyDecrypted = !!source.rawDataJson;
          if (isCurrent && !isCurrent()) return;
          if (
            decryptedItem.dbItem &&
            decryptedItem?.rawDataJson?.dataType === this.dataType
          ) {
            const payload = decryptedItem?.rawDataJson?.payload;
            if (payload) {
              const target = await this.buildSyncTargetByPayload({
                payload: payload as any,
              });
              if (isCurrent && !isCurrent()) return;
              // if (!target) {
              //   const dbRecord = await this.getDBRecordBySyncPayload({
              //     payload: payload as any,
              //   });
              //   if (dbRecord) {
              //     target = await this.buildSyncTargetByDBQuery({
              //       dbRecord,
              //     });
              //   }
              // }
              // Mirror the isSupportSync gate used on the upload side.
              if (target && (await this.isSupportSync(target))) {
                const keyInfo = await this.buildSyncKeyAndPayload({
                  target,
                  callerName: 'syncToScene',
                });
                if (isCurrent && !isCurrent()) return;
                // recheck the key
                // TODO server data may be incorrect, how to remove it from server?
                if (keyInfo.key === item.id) {
                  // TODO batch update
                  const isSuccess = await this.syncToSceneEachItemByMutex({
                    item: source,
                    isCurrent,
                    onWalletNameHistoryDeferred,
                    target,
                    payload: payload as any,
                  });
                  if (isCurrent && !isCurrent()) return;
                  if (
                    isSuccess &&
                    (wasAlreadyDecrypted ||
                      localSceneUpdated !== true ||
                      pwdHash !== decryptedItem.dbItem.pwdHash ||
                      rawData !== decryptedItem.dbItem.rawData ||
                      rawKey !== (rawKey || decryptedItem.dbItem.rawKey))
                  ) {
                    await this.backgroundApi.localDb.updateSyncItem({
                      ids: [item.id],
                      isCurrent,
                      updater: (record) => {
                        // A newer download/local edit can arrive while the scene
                        // update awaits. Never acknowledge or replace its cache.
                        if (
                          (isCurrent && !isCurrent()) ||
                          !matchesCloudSyncSceneSource(record, source)
                        ) {
                          return record;
                        }
                        record.localSceneUpdated = true;
                        record.pwdHash = decryptedItem.dbItem.pwdHash;
                        record.rawData = decryptedItem.dbItem.rawData;
                        record.rawKey =
                          record.rawKey || decryptedItem.dbItem.rawKey;
                        return record;
                      },
                    });
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('syncToScene error', error);
      }
    }
  }

  async buildInitSyncDBItems({
    dbRecords,
    allDevices,
    initDataTime,
    syncCredential,
    requiredSyncItems,
  }: {
    dbRecords: ICloudSyncDBRecords;
    allDevices?: IDBDevice[];
    initDataTime: number | undefined;
    syncCredential: ICloudSyncCredential;
    // An undefined raw key still requires an exact match on the hashed ID.
    requiredSyncItems?: ReadonlyMap<string, string | undefined>;
  }) {
    return this._buildInitSyncDBItems({
      dbRecords,
      allDevices,
      initDataTime,
      syncCredential,
      requiredSyncItems,
    });
  }

  async _buildInitSyncDBItems({
    dbRecords,
    allDevices,
    initDataTime,
    syncCredential,
    requiredSyncItems,
  }: {
    dbRecords: ICloudSyncDBRecords;
    allDevices?: IDBDevice[];
    initDataTime: number | undefined;
    syncCredential: ICloudSyncCredential | undefined;
    requiredSyncItems?: ReadonlyMap<string, string | undefined>;
  }) {
    const results: IDBCloudSyncItem[] = [];
    for (let offset = 0; offset < dbRecords.length; offset += 50) {
      const batch = await Promise.all(
        dbRecords.slice(offset, offset + 50).map(async (record) => {
          const dbRecord = record as TRecord;
          const target = await this.buildSyncTargetByDBQuery({
            dbRecord,
            allDevices,
          });
          const keyInfo = await this.buildSyncKeyInfo({ target });
          if (!keyInfo || !keyInfo.key) {
            // dbRecord is not supported sync
            return null;
          }
          if (requiredSyncItems) {
            const rawKey = requiredSyncItems.get(keyInfo.key);
            if (
              !requiredSyncItems.has(keyInfo.key) ||
              (rawKey !== undefined && rawKey !== keyInfo.rawKey)
            ) {
              return null;
            }
          }
          const existingSyncItem =
            await this.backgroundApi.localDb.getSyncItemSafe({
              id: keyInfo?.key,
            });
          if (
            !requiredSyncItems &&
            existingSyncItem &&
            syncCredential &&
            cloudSyncItemBuilder.getPwdHash(syncCredential) &&
            existingSyncItem.pwdHash ===
              cloudSyncItemBuilder.getPwdHash(syncCredential)
          ) {
            // pwdHash matched, do not need rebuild sync item
            return null;
          }

          const item = await this.buildSyncItem({
            target,
            dataTime: initDataTime,
            preserveUndefinedDataTime: true,
            syncCredential,
          });
          return item;
        }),
      );
      results.push(...batch.filter((item): item is IDBCloudSyncItem => !!item));
      if (offset + 50 < dbRecords.length) await timerUtils.wait(0);
    }
    return results;
  }
}
