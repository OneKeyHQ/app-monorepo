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
- Desktop | Web: WebStorage -> IndexedDB
 */

if (platformEnv.isDev) {
  global.$$appStorage = appStorage;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.$$appStorage.print = async () => {
    const keys = await appStorage.getAllKeys();
    for (const key of keys) {
      const item = await appStorage.getItem(key);
      let itemJson = item;
      try {
        itemJson = JSON.parse(item as string);
      } catch (error) {
        // noop
      } finally {
        // noop
      }
      console.log(key, '\r\n\t\t', itemJson);
    }
  };
}

export { mockStorage };
export default appStorage;
