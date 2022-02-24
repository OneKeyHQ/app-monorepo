import Realm from 'realm';

import {
  HistoryEntry,
  HistoryEntryStatus,
  HistoryEntryType,
} from '../../../types/history';

class HistoryEntrySchema extends Realm.Object {
  // Transaction base below.
  public id!: string;

  public networkId!: string;

  public accountId!: string;

  public status!: HistoryEntryStatus;

  public type!: HistoryEntryType;

  public createdAt!: number;

  public updatedAt!: number;

  // Transaction meta below.
  public contract?: string;

  public target?: string;

  public value?: string;

  public rawTx?: string;

  public ref?: string;

  public static schema: Realm.ObjectSchema = {
    name: 'HistoryEntry',
    primaryKey: 'id',
    properties: {
      id: 'string',
      networkId: 'string',
      accountId: 'string',
      status: 'string',
      type: 'string',
      createdAt: 'int',
      updatedAt: 'int',
      contract: 'string?',
      target: 'string?',
      value: 'string?',
      rawTx: 'string?',
      ref: 'string?',
    },
  };

  get internalObj(): HistoryEntry {
    // TODO: different types
    const ret = {
      id: this.id,
      status: this.status,
      type: this.type,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      contract: this.contract || '',
      target: this.target || '',
      value: this.value || '',
      rawTx: this.rawTx || '',
    };
    if (this.ref !== null) {
      Object.assign(ret, { ref: this.ref });
    }
    return ret;
  }
}

export { HistoryEntrySchema };
