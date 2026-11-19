import { createMMKV } from 'react-native-mmkv';

const appStorageMMKVInstance = createMMKV({
  id: 'onekey-app-storage-v1',
});

export default appStorageMMKVInstance;
