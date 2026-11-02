import { createOneKeyMMKV } from './createOneKeyMMKV';

const mmkvStorageInstance = createOneKeyMMKV({
  id: `onekey-app-setting`,
  enableWriteProtection: true,
});
export default mmkvStorageInstance;
