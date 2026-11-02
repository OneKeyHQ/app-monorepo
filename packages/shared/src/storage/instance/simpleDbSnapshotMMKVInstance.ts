import { createOneKeyMMKV } from './createOneKeyMMKV';

const simpleDbSnapshotMMKVInstance = createOneKeyMMKV({
  id: 'onekey-display-snapshot-simple-db-cache',
  enableWriteProtection: false,
});

export default simpleDbSnapshotMMKVInstance;
