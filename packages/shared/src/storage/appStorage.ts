// ERROR: (init localStorage in web, but ext background cannot support localStorage)
//    redux-persist failed to create sync storage. falling back to noop storage.
// import storage from 'redux-persist/lib/storage';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isDev, isExtension } from '../platformEnv';

// TODO use localForage (indexedDB fallback)
import ExtensionStorage from './ExtensionStorage';
import MockStorage from './MockStorage';

// const appStorage: WebStorage = storage; // use redux-persist built-in storage
// const appStorage = AsyncStorage
const appStorage = isExtension() ? new ExtensionStorage() : AsyncStorage;
const mockStorage = new MockStorage();

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
- Desktop: AsyncStorage -> window.localStorage
 */

if (isDev()) {
  global.$$appStorage = appStorage;
}

export { mockStorage };
export default appStorage;
