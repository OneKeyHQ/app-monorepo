import type { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';

export type IMigrateRecordsResult = {
  name: ELocalDBStoreNames;
  dbName?: string;
  recordsCount: number;
  storeCount: number;
  error?: string;
  flag?: string;
};
