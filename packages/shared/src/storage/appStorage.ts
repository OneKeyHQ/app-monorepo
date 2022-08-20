// ERROR: (init localStorage in web, but ext background cannot support localStorage)
//    redux-persist failed to create sync storage. falling back to noop storage.
// import storage from 'redux-persist/lib/storage';

import AsyncStorage, {
  AsyncStorageStatic,
} from '@react-native-async-storage/async-storage';

import platformEnv from '../platformEnv';

// TODO use localForage (indexedDB fallback)
import ExtensionStorage from './ExtensionStorage';
import MockStorage from './MockStorage';

// const appStorage: WebStorage = storage; // use redux-persist built-in storage
// const appStorage = AsyncStorage
const appStorage: AsyncStorageStatic = platformEnv.isExtension
  ? new ExtensionStorage()
  : AsyncStorage;
const mockStorage = new MockStorage();

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
- Desktop: AsyncStorage -> window.localStorage
 */

if (platformEnv.isDev) {
  global.$$appStorage = appStorage;
}

export { mockStorage };
export default appStorage;
