import type { AsyncStorageStatic } from '@onekeyhq/shared/src/storage/appStorageTypes';
import extensionStorageInstance from '@onekeyhq/shared/src/storage/instance/extensionStorageInstance';

const v4appStorage: AsyncStorageStatic = extensionStorageInstance;
export { v4appStorage };
