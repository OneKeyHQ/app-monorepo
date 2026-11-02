import { createOneKeyMMKV } from './createOneKeyMMKV';

const mmkvDevSettingStorageInstance = createOneKeyMMKV({
  id: `onekey-app-dev-setting`,
  enableWriteProtection: false,
});
export default mmkvDevSettingStorageInstance;
