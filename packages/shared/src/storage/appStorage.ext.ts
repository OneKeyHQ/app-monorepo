// ERROR: (init localStorage in web, but ext background cannot support localStorage)
//    redux-persist failed to create sync storage. falling back to noop storage.
// import storage from 'redux-persist/lib/storage';

import ExtensionStorage from './ExtensionStorage';
import MockStorage from './MockStorage';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

const appStorage: AsyncStorageStatic = new ExtensionStorage();

export const mockStorage = new MockStorage();

/*
- Extension internal: ExtensionStorage
- Extension injected: AsyncStorage -> window.localStorage
- App: AsyncStorage -> RN AsyncStorage
- Desktop | Web: WebStorage -> IndexedDB
 */

if (process.env.NODE_ENV !== 'production') {
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
export default appStorage;
