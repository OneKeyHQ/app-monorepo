import { ELocalDBStoreNames } from '../../localDBStoreNames';
import { RealmObjectBase } from '../base/RealmObjectBase';

import type { IDBSignedMessage } from '../../types';
import type Realm from 'realm';

class RealmSchemaSignMessage extends RealmObjectBase<IDBSignedMessage> {
  public id!: string;

  public networkId!: string;

  public title!: string;

  public address!: string;

  public contentType!: string;

  public message!: string;

  public createdAt!: number;

  public static override schema: Realm.ObjectSchema = {
    name: ELocalDBStoreNames.SignedMessage,
    primaryKey: 'id',
    properties: {
      id: 'string',
      networkId: 'string',
      title: 'string',
      address: 'string',
      contentType: 'string',
      message: 'string',
      createdAt: 'int',
    },
  };

  get record(): IDBSignedMessage {
    return {
      id: this.id,
      title: this.title,
      networkId: this.networkId,
      address: this.address,
      contentType: this.contentType as 'text' | 'json',
      message: this.message,
      createdAt: this.createdAt,
    };
  }
}

export { RealmSchemaSignMessage };
