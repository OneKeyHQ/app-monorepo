import WebStorage from '../WebStorage';
import WebStorageLegacy from '../WebStorageLegacy';

const webStorageLegacy = new WebStorageLegacy();

const webStorage = new WebStorage({
  dbName: 'OneKeyAppStorage',
  bucketName: 'app-storage_onekey-bucket',
  tableName: 'keyvaluepairs',
  legacyKeyPrefix: 'app_storage_v5:',
});

const webStorageSimpleDB = new WebStorage({
  dbName: 'OneKeySimpleDB',
  bucketName: 'simple-db_onekey-bucket',
  tableName: 'keyvaluepairs',
  legacyKeyPrefix: 'simple_db_v5:',
});

const webStorageGlobalStates = new WebStorage({
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
