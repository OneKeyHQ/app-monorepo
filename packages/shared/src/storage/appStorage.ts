import { buildAppStorageFactory } from './appStorageBuildFactory';
import mockStorageInstance from './instance/mockStorageInstance';
import nativeAsyncStorageInstance from './instance/nativeAsyncStorageInstance';

import type { IAppStorageHub } from './appStorageTypes';

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage-compatible API -> native bg MMKV proxy
- Desktop | Web: WebStorage -> IndexedDB
 */

const appStorage = buildAppStorageFactory(nativeAsyncStorageInstance);
export default appStorage;
export const storageHub: IAppStorageHub = {
  appStorage,
  _mockStorage: mockStorageInstance,
  // web storage
  _webStorageLegacy: undefined,
  $webStorageSimpleDB: undefined,
  $webStorageGlobalStates: undefined,
};
