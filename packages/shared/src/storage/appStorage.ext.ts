import appGlobals from '../appGlobals';

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

export default buildAppStorageFactory(appStorage);
