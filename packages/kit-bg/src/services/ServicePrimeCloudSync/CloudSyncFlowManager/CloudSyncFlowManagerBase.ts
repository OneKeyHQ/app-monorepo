import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import type { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME } from '@onekeyhq/shared/src/consts/primeConsts';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import cloudSyncUtils from '@onekeyhq/shared/src/utils/cloudSyncUtils';
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
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetMap[T]; // local db target
    payload: ICloudSyncPayloadMap[T]; // decrypted cloud sync payload
  }): Promise<boolean>;

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

  async getSyncCredential() {
    return this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();
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
    syncCredential,
  }: {
    dbRecord: TRecord;
    allDevices?: IDBDevice[];
    isDeleted: boolean | undefined;
    dataTime: number | undefined;
    syncCredential: ICloudSyncCredential | undefined;
  }): Promise<IDBCloudSyncItem | undefined> {
    const target = await this.buildSyncTargetByDBQuery({
      dbRecord,
      allDevices,
    });
    return this.buildSyncItem({
      target,
      dataTime,
      syncCredential,
      isDeleted,
    });
  }

  async buildSyncItem({
    target,
    dataTime,
    syncCredential,
    isDeleted,
  }: {
    target: ICloudSyncTargetMap[T];
    dataTime: number | undefined;
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
      const item = await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
        key,
        rawDataJson: {
          rawKey,
          payload: payload as any,
          dataType: dataType as any,
        },
        syncCredential,
        dataTime,
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
      return syncItem;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return undefined;
    }
  }

  async buildExistingSyncItemsInfo({
    tx,
    targets,
    useCreateGenesisTime,
    onExistingSyncItemsInfo,
  }: {
    tx?: ILocalDBTransaction;
    targets: Array<ICloudSyncTargetMap[T]>;
    useCreateGenesisTime?: (params: {
      target: ICloudSyncTargetMap[T];
    }) => Promise<boolean>;
    onExistingSyncItemsInfo: (
      existingSyncItemsInfo: IExistingSyncItemsInfo<T>,
    ) => Promise<void>;
  }) {
    const newSyncItems: IDBCloudSyncItem[] = [];
    const existingSyncItems: IDBCloudSyncItem[] = [];
    const existingSyncItemsInfo: IExistingSyncItemsInfo<T> = {};

    const syncCredential = await this.getSyncCredential();
    const canSyncWithoutServer = cloudSyncUtils.canSyncWithoutServer(
      this.dataType,
    );

    for (const target of targets) {
      let existingSyncItem: IDBCloudSyncItem | undefined;

      if (
        canSyncWithoutServer ||
        (await this.backgroundApi.servicePrimeCloudSync.isCloudSyncIsAvailable())
      ) {
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
        const newSyncItem = await this.buildSyncItem({
          syncCredential,
          target,
          dataTime: await (async () => {
            if (useCreateGenesisTime) {
              if (await useCreateGenesisTime({ target })) {
                console.log(
                  'useCreateGenesisTime PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME',
                  PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME,
                );
                return PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME;
              }
            }
            return this.timeNow();
          })(),
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
        void this.backgroundApi?.servicePrimeCloudSync.startServerSyncFlowForItems(
          {
            localItems,
          },
        );
      }
    }

    return txResult;
  }

  async syncToScene({
    syncCredential,
    items,
    forceSync,
  }: {
    syncCredential: ICloudSyncCredential | undefined;
    items: IDBCloudSyncItem[];
    forceSync?: boolean;
  }) {
    if (!items.length) {
      return;
    }
    // if (!syncCredential) {
    //   return;
    // }
    for (const item of items) {
      try {
        const shouldSync =
          forceSync ||
          (syncCredential &&
            cloudSyncItemBuilder.canLocalItemSyncToScene({
              item,
              syncCredential,
            }));
        if (item.dataType === this.dataType && shouldSync) {
          // TODO performance issue of decrypting in the loop
          const decryptedItem = await cloudSyncItemBuilder.decryptSyncItem({
            item,
            syncCredential,
          });
          if (
            decryptedItem.dbItem &&
            decryptedItem?.rawDataJson?.dataType === this.dataType
          ) {
            const payload = decryptedItem?.rawDataJson?.payload;
            if (payload) {
              const target = await this.buildSyncTargetByPayload({
                payload: payload as any,
              });
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
              if (target) {
                const keyInfo = await this.buildSyncKeyAndPayload({
                  target,
                  callerName: 'syncToScene',
                });
                // recheck the key
                // TODO server data may be incorrect, how to remove it from server?
                if (keyInfo.key === item.id) {
                  // TODO batch update
                  const isSuccess = await this.syncToSceneEachItem({
                    item,
                    target,
                    payload: payload as any,
                  });
                  if (isSuccess) {
                    await this.backgroundApi.localDb.updateSyncItem({
                      ids: [item.id],
                      updater: (record) => {
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
  }: {
    dbRecords: ICloudSyncDBRecords;
    allDevices?: IDBDevice[];
    initDataTime: number | undefined;
    syncCredential: ICloudSyncCredential;
  }) {
    return this._buildInitSyncDBItems({
      dbRecords,
      allDevices,
      initDataTime,
      syncCredential,
    });
  }

  async _buildInitSyncDBItems({
    dbRecords,
    allDevices,
    initDataTime,
    syncCredential,
  }: {
    dbRecords: ICloudSyncDBRecords;
    allDevices?: IDBDevice[];
    initDataTime: number | undefined;
    syncCredential: ICloudSyncCredential | undefined;
  }) {
    return (
      await Promise.all(
        dbRecords.map(async (record) => {
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
          const existingSyncItem =
            await this.backgroundApi.localDb.getSyncItemSafe({
              id: keyInfo?.key,
            });
          if (
            existingSyncItem &&
            syncCredential &&
            syncCredential.masterPasswordUUID &&
            existingSyncItem.pwdHash === syncCredential.masterPasswordUUID
          ) {
            // pwdHash matched, do not need rebuild sync item
            return null;
          }

          const item = await this.buildSyncItem({
            target,
            dataTime: initDataTime,
            syncCredential,
          });
          return item;
        }),
      )
    ).filter(Boolean);
  }
}
