// ERROR: (init localStorage in web, but ext background cannot support localStorage)
//    redux-persist failed to create sync storage. falling back to noop storage.
// import storage from 'redux-persist/lib/storage';

import platformEnv from '../platformEnv';

import { buildAppStorageFactory } from './appSetting';
import { createPrintMethod } from './createPrintMethod';
import mockStorageInstance from './instance/mockStorageInstance';
import nativeAsyncStorageInstance from './instance/nativeAsyncStorageInstance';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

const appStorage: AsyncStorageStatic = // iOS/Android AsyncStorage
  nativeAsyncStorageInstance;

// https://stackoverflow.com/questions/46736268/react-native-asyncstorage-clear-is-failing-on-ios
appStorage.clear = async () => {
  const asyncStorageKeys = await nativeAsyncStorageInstance.getAllKeys();
  if (asyncStorageKeys.length > 0) {
    if (platformEnv.isNativeAndroid) {
      await nativeAsyncStorageInstance.clear();
    } else if (platformEnv.isNativeIOS) {
      await nativeAsyncStorageInstance.multiRemove(asyncStorageKeys);
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

if (process.env.NODE_ENV !== 'production') {
  global.$$appStorage = appStorage;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.$$appStorage.print = createPrintMethod({ storage: appStorage });
}

export default buildAppStorageFactory(appStorage);
