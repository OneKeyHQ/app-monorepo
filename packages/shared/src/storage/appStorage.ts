// ERROR: (init localStorage in web, but ext background cannot support localStorage)
//    redux-persist failed to create sync storage. falling back to noop storage.
// import storage from 'redux-persist/lib/storage';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isDev, isExtension } from '../platformEnv';

// TODO use localForage (indexedDB fallback)
import ExtensionStorage from './ExtensionStorage';

// const appStorage: WebStorage = storage; // use redux-persist built-in storage
// const appStorage = AsyncStorage
const appStorage = isExtension() ? new ExtensionStorage() : AsyncStorage;

if (isDev()) {
  global.$$appStorage = appStorage;
}

export default appStorage;
