import { createMMKV } from 'react-native-mmkv';

const mmkvStorageInstance = createMMKV({ id: `onekey-app-setting` });
export default mmkvStorageInstance;
