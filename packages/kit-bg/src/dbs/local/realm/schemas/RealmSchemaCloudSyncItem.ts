import type { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBCloudSyncItem } from '../../types';
import type Realm from 'realm';

// TODO rename to CloudSyncPool
export class RealmSchemaCloudSyncItem extends RealmObjectBase<IDBCloudSyncItem> {
  public id!: string; // key

  public rawKey!: string;

  public rawData?: string;

  public dataType!: EPrimeCloudSyncDataType;

  public data?: string;

  public dataTime?: number;

  public isDeleted!: boolean;

  public pwdHash!: string;

  public localSceneUpdated!: boolean;

  public serverUploaded!: boolean;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.CloudSyncItem,
    primaryKey: 'id',
    properties: {
      id: 'string', // key
      rawKey: 'string',
      rawData: 'string?',
      dataType: 'string', // EPrimeCloudSyncDataType
      data: 'string?',
      dataTime: 'int?',
      isDeleted: 'bool',
      pwdHash: 'string',
      localSceneUpdated: 'bool',
      serverUploaded: 'bool',
    },
  };

  get record(): IDBCloudSyncItem {
    return {
      id: this.id, // key
      rawKey: this.rawKey,
      rawData: this.rawData ?? undefined,
      dataType: this.dataType,
      data: this.data ?? undefined,
      dataTime: this.dataTime ?? undefined,
      isDeleted: this.isDeleted,
      pwdHash: this.pwdHash,
      localSceneUpdated: this.localSceneUpdated,
      serverUploaded: this.serverUploaded,
    };
  }
}
