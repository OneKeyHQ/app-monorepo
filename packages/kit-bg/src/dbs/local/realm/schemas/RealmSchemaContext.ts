// eslint-disable-next-line max-classes-per-file

import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBContext } from '../../types';
import type Realm from 'realm';

class RealmSchemaContext extends RealmObjectBase<IDBContext> {
  public id!: string;

  public nextHD!: number;

  public nextWalletNo!: number;

  public verifyString!: string;

  public networkOrderChanged?: boolean;

  public backupUUID!: string;

  public nextSignatureMessageId!: number;

  public nextSignatureTransactionId!: number;

  public nextConnectedSiteId!: number;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.Context,
    primaryKey: 'id',
    properties: {
      id: 'string',
      nextHD: 'int',
      nextWalletNo: 'int',
      verifyString: 'string',
      networkOrderChanged: { type: 'bool', default: false },
      backupUUID: { type: 'string', default: '' },
      nextSignatureMessageId: { type: 'int', default: 1 },
      nextSignatureTransactionId: { type: 'int', default: 1 },
      nextConnectedSiteId: { type: 'int', default: 1 },
    },
  };

  get record(): IDBContext {
    return {
      id: this.id,
      nextHD: this.nextHD,
      nextWalletNo: this.nextWalletNo,
      verifyString: this.verifyString,
      networkOrderChanged: this.networkOrderChanged || false,
      backupUUID: this.backupUUID,
      nextSignatureMessageId: this.nextSignatureMessageId,
      nextSignatureTransactionId: this.nextSignatureTransactionId,
      nextConnectedSiteId: this.nextConnectedSiteId,
    };
  }
}
export { RealmSchemaContext };
