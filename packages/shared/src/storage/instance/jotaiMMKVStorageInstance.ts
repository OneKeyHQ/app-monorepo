import { createMMKV } from 'react-native-mmkv';

const jotaiMMKVStorageInstance = createMMKV({ id: 'onekey-jotai-states' });
export default jotaiMMKVStorageInstance;
