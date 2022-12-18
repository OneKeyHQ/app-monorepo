import Realm from 'realm';

import { NotImplemented } from '../../../errors';
import { HistoryEntryType } from '../../../types/history';

import type { HistoryEntry, HistoryEntryStatus } from '../../../types/history';

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

  public rawTxPreDecodeCache?: string;

  public payload?: string;

  // Message meta below.
  public message?: string;

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
      message: 'string?',
      ref: 'string?',
      rawTxPreDecodeCache: 'string?',
      payload: 'string?',
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
    };
    if (this.ref !== null) {
      Object.assign(ret, { ref: this.ref });
    }
    switch (this.type) {
      case HistoryEntryType.TRANSFER:
        return {
          ...ret,
          contract: this.contract || '',
          target: this.target || '',
          value: this.value || '',
          rawTx: this.rawTx || '',
          rawTxPreDecodeCache: this.rawTxPreDecodeCache || '',
          payload: this.payload || '',
        };
      case HistoryEntryType.SIGN:
        return {
          ...ret,
          message: this.message || '',
        };
      default:
        throw new NotImplemented();
    }
  }
}

export { HistoryEntrySchema };
