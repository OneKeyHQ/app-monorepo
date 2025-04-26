import platformEnv from '../platformEnv';

import mockStorageInstance from './instance/mockStorageInstance';
import nativeAsyncStorageInstance from './instance/nativeAsyncStorageInstance';
import { buildAppStorageFactory } from './syncStorage';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

const appStorage: AsyncStorageStatic = // iOS/Android AsyncStorage
  nativeAsyncStorageInstance;

const originalClear = appStorage.clear;
// https://stackoverflow.com/questions/46736268/react-native-asyncstorage-clear-is-failing-on-ios
appStorage.clear = async () => {
  const asyncStorageKeys = await appStorage.getAllKeys();
  if (asyncStorageKeys.length > 0) {
    if (platformEnv.isNativeAndroid) {
      await originalClear.call(appStorage);
    } else if (platformEnv.isNativeIOS) {
      await appStorage.multiRemove(asyncStorageKeys);
    }
  }
};

export const mockStorage = mockStorageInstance;

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
- Desktop | Web: WebStorage -> IndexedDB
 */

export default buildAppStorageFactory(appStorage);
