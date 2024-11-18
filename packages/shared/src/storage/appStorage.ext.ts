// ERROR: (init localStorage in web, but ext background cannot support localStorage)
//    redux-persist failed to create sync storage. falling back to noop storage.
// import storage from 'redux-persist/lib/storage';

import { createPrintMethod } from './createPrintMethod';
import mockStorageInstance from './instance/mockStorageInstance';
import webStorageInstance from './instance/webStorageInstance';
import { buildAppStorageFactory } from './syncStorage';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

// const appStorage: AsyncStorageStatic = extensionStorageInstance; // v4
const appStorage: AsyncStorageStatic = webStorageInstance; // v5

export const mockStorage = mockStorageInstance;

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
- Desktop | Web: WebStorage -> IndexedDB
 */

if (process.env.NODE_ENV !== 'production') {
  globalThis.$$appStorage = appStorage;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  globalThis.$$appStorage.print = createPrintMethod({ storage: appStorage });
}
export default buildAppStorageFactory(appStorage);
