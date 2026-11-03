import { createOneKeyMMKV } from './createOneKeyMMKV';

const jotaiMMKVStorageInstance = createOneKeyMMKV({
  id: 'onekey-jotai-states',
  enableWriteProtection: true,
});
export default jotaiMMKVStorageInstance;
