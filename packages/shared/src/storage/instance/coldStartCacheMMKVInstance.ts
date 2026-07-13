import { createMMKV } from 'react-native-mmkv';

const coldStartCacheMMKVInstance = createMMKV({
  id: 'onekey-cold-start-cache',
});
export default coldStartCacheMMKVInstance;
