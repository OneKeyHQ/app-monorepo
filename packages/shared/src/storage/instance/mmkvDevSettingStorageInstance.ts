import { createMMKV } from 'react-native-mmkv';

const mmkvDevSettingStorageInstance = createMMKV({
  id: `onekey-app-dev-setting`,
});
export default mmkvDevSettingStorageInstance;
