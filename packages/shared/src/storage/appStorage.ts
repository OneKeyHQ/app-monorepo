// ERROR: (init localStorage in web, but ext background cannot support localStorage)
//    redux-persist failed to create sync storage. falling back to noop storage.
// import storage from 'redux-persist/lib/storage';

import AsyncStorage, {
  AsyncStorageStatic,
} from '@react-native-async-storage/async-storage';

import platformEnv from '../platformEnv';

import ExtensionStorage from './ExtensionStorage';
import MockStorage from './MockStorage';
import WebStorage from './WebStorage';

const appStorage: AsyncStorageStatic = (() => {
  if (platformEnv.isExtension) {
    // Extension cross storage for firefox & chrome
    return new ExtensionStorage();
  }
  if (platformEnv.isDesktop || platformEnv.isWeb) {
    // IndexedDB in web:
    //    OneKeyStorage -> keyvaluepairs
    return new WebStorage();
  }
  // iOS/Android AsyncStorage
  return AsyncStorage;
})();

const mockStorage = new MockStorage();

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
- Desktop/Web: WebStorage -> IndexedDB
 */

if (platformEnv.isDev) {
  global.$$appStorage = appStorage;
}

export { mockStorage };
export default appStorage;
