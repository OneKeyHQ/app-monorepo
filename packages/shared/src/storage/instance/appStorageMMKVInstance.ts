import { createOneKeyMMKV } from './createOneKeyMMKV';

const appStorageMMKVInstance = createOneKeyMMKV({
  id: 'onekey-app-storage-v1',
  enableWriteProtection: true,
});

export default appStorageMMKVInstance;
