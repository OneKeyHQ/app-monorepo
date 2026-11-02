import { createOneKeyMMKV } from './createOneKeyMMKV';

const jotaiSnapshotMMKVStorageInstance = createOneKeyMMKV({
  id: 'onekey-display-snapshot-jotai-cache',
  enableWriteProtection: false,
});

export default jotaiSnapshotMMKVStorageInstance;
