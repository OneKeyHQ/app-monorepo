import type { EV4LocalDBStoreNames } from './v4localDBStoreNames';
import type {
  IV4LocalDBSchemaMap,
  IV4LocalDBTransactionStores,
  IV4RealmDBSchemaMap,
} from './v4localDBTypesSchemaMap';

// withTransaction
export interface IV4LocalDBTransaction {
  stores?: IV4LocalDBTransactionStores;
}
export type IV4LocalDBWithTransactionTask<T> = (
  tx: IV4LocalDBTransaction,
) => Promise<T>;
export type IV4LocalDBWithTransactionOptions = {
  readOnly?: boolean;
};

// GetRecordsCount
export interface IV4LocalDBGetRecordsCountParams<
  T extends EV4LocalDBStoreNames,
> {
  name: T;
}
export interface IV4LocalDBTxGetRecordsCountParams<
  T extends EV4LocalDBStoreNames,
> {
  tx: IV4LocalDBTransaction;
  name: T;
}
export interface IV4LocalDBGetRecordsCountResult {
  count: number;
}

export type IV4LocalDBRecord<T extends EV4LocalDBStoreNames> =
  IV4LocalDBSchemaMap[T];

export type IV4LocalDBRecordPair<T extends EV4LocalDBStoreNames> = [
  IV4LocalDBRecord<T>,
  IV4RealmDBSchemaMap[T] | null,
];

// GetRecordById
export interface IV4LocalDBTxGetRecordByIdParams<
  T extends EV4LocalDBStoreNames,
> {
  tx: IV4LocalDBTransaction;
  name: T;
  id: string;
}
export type IV4LocalDBTxGetRecordByIdResult<T extends EV4LocalDBStoreNames> =
  IV4LocalDBRecordPair<T>;

export interface IV4LocalDBGetRecordByIdParams<T extends EV4LocalDBStoreNames> {
  name: T;
  id: string;
}
export type IV4LocalDBGetRecordByIdResult<T extends EV4LocalDBStoreNames> =
  IV4LocalDBRecord<T>;

// GetRecords
export type IV4LocalDBGetRecordsQuery = {
  ids?: string[];
  limit?: number;
  offset?: number;
};
export type IV4LocalDBTxGetAllRecordsParams<T extends EV4LocalDBStoreNames> = {
  tx: IV4LocalDBTransaction;
  name: T;
} & IV4LocalDBGetRecordsQuery;
export interface IV4LocalDBTxGetAllRecordsResult<
  T extends EV4LocalDBStoreNames,
> {
  recordPairs: IV4LocalDBRecordPair<T>[];
  records: IV4LocalDBRecord<T>[];
}

export type IV4LocalDBGetAllRecordsParams<T extends EV4LocalDBStoreNames> = {
  name: T;
} & IV4LocalDBGetRecordsQuery;
export interface IV4LocalDBGetAllRecordsResult<T extends EV4LocalDBStoreNames> {
  records: IV4LocalDBRecord<T>[];
  // recordPairs is only available of txGetAllRecords()
}

// UpdateRecords
export interface IV4LocalDBTxUpdateRecordsParams<
  T extends EV4LocalDBStoreNames,
> {
  tx: IV4LocalDBTransaction;
  name: T;
  recordPairs?: IV4LocalDBRecordPair<T>[];
  ids?: string[];
  updater: IV4LocalDBRecordUpdater<T>;
}

// AddRecords
export interface IV4LocalDBTxAddRecordsParams<T extends EV4LocalDBStoreNames> {
  tx: IV4LocalDBTransaction;
  name: T;
  records: IV4LocalDBRecord<T>[];
  skipIfExists?: boolean; // TODO skip
}
export interface IV4LocalDBTxAddRecordsResult {
  added: number;
  addedIds: string[];
  skipped: number;
}

// RemoveRecords
export interface IV4LocalDBTxRemoveRecordsParams<
  T extends EV4LocalDBStoreNames,
> {
  tx: IV4LocalDBTransaction;
  name: T;
  recordPairs?: IV4LocalDBRecordPair<T>[];
  ids?: string[];
  ignoreNotFound?: boolean;
}

export type IV4LocalDBRecordUpdater<T extends EV4LocalDBStoreNames> = <
  T1 extends IV4LocalDBRecord<T> | IV4RealmDBSchemaMap[T],
>(
  record: T1,
) => Promise<T1> | T1;
