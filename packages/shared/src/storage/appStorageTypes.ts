import type MockStorage from './MockStorage';
import type { IAppStorage } from './syncStorage';
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export type IAppStorageHub = {
  appStorage: AsyncStorageStatic;
  _mockStorage: MockStorage;
  // web storage
  _webStorageLegacy: IAppStorage | undefined;
  $webStorageSimpleDB: IAppStorage | undefined;
  $webStorageGlobalStates: IAppStorage | undefined;
};
