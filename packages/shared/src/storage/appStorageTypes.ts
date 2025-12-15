import type { ISyncStorage } from './instance/syncStorageInstance';
import type MockStorage from './MockStorage';
import type { ISecureStorage } from './secureStorage/types';
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export interface IAppStorage extends AsyncStorageStatic {
  syncStorage: ISyncStorage;
  secureStorage: ISecureStorage;
}

export { AsyncStorageStatic };

export type IAppStorageHub = {
  appStorage: AsyncStorageStatic;
  _mockStorage: MockStorage;
  // web storage
  _webStorageLegacy: IAppStorage | undefined;
  $webStorageSimpleDB: IAppStorage | undefined;
  $webStorageGlobalStates: IAppStorage | undefined;
};
