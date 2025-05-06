import platformEnv from '../../platformEnv';
import WebStorage from '../WebStorage';
import WebStorageLegacy from '../WebStorageLegacy';

const webStorageLegacy = new WebStorageLegacy();

const webStorage = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeyAppStorage',
      bucketName: 'app-storage_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: 'app_storage_v5:',
    });

const webStorageSimpleDB = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeySimpleDB',
      bucketName: 'simple-db_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: 'simple_db_v5:',
    });

const webStorageGlobalStates = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeyGlobalStates',
      bucketName: 'global-states_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: 'g_states_v5:',
    });

export {
  webStorageLegacy,
  webStorage,
  webStorageSimpleDB,
  webStorageGlobalStates,
};
