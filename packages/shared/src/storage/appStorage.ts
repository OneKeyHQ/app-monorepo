import platformEnv from '../platformEnv';

import mockStorageInstance from './instance/mockStorageInstance';
import nativeAsyncStorageInstance from './instance/nativeAsyncStorageInstance';
import { buildAppStorageFactory } from './syncStorage';

import type { IAppStorageHub } from './appStorageTypes';

const originalClear = nativeAsyncStorageInstance.clear;
// https://stackoverflow.com/questions/46736268/react-native-asyncstorage-clear-is-failing-on-ios
nativeAsyncStorageInstance.clear = async () => {
  const asyncStorageKeys = await nativeAsyncStorageInstance.getAllKeys();
  if (asyncStorageKeys.length > 0) {
    if (platformEnv.isNativeAndroid) {
      await originalClear.call(nativeAsyncStorageInstance);
    } else if (platformEnv.isNativeIOS) {
      await nativeAsyncStorageInstance.multiRemove(asyncStorageKeys);
    }
  }
};

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
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
