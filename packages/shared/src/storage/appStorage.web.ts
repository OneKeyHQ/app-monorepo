import mockStorageInstance from './instance/mockStorageInstance';
import {
  webStorage,
  webStorageGlobalStates,
  webStorageLegacy,
  webStorageSimpleDB,
} from './instance/webStorageInstance';
import { buildAppStorageFactory } from './syncStorage';

import type { IAppStorageHub } from './appStorageTypes';

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
- Desktop | Web: WebStorage -> IndexedDB
 */

const appStorage = buildAppStorageFactory(webStorage);
export default appStorage;
export const storageHub: IAppStorageHub = {
  appStorage,
  _mockStorage: mockStorageInstance,
  // web storage
  _webStorageLegacy: buildAppStorageFactory(webStorageLegacy),
  $webStorageSimpleDB: buildAppStorageFactory(webStorageSimpleDB),
  $webStorageGlobalStates: buildAppStorageFactory(webStorageGlobalStates),
};
