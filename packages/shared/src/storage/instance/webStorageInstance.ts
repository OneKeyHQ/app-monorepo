import platformEnv from '../../platformEnv';
import WebStorage, { EWebStorageKeyPrefix } from '../WebStorage';
import WebStorageLegacy from '../WebStorageLegacy';

const webStorageLegacy = new WebStorageLegacy();

const webStorage = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeyAppStorage',
      bucketName: 'app-storage_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: EWebStorageKeyPrefix.AppStorage,
    });

const webStorageSimpleDB = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeySimpleDB',
      bucketName: 'simple-db_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: EWebStorageKeyPrefix.SimpleDB,
    });

const webStorageGlobalStates = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeyGlobalStates',
      bucketName: 'global-states_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: EWebStorageKeyPrefix.GlobalStates,
    });

export {
  webStorageLegacy,
  webStorage,
  webStorageSimpleDB,
  webStorageGlobalStates,
};
