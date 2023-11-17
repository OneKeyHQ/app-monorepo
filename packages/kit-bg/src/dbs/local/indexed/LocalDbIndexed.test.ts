import * as consts from '../consts';
import { DB_MAIN_CONTEXT_ID, INDEXED_DB_VERSION } from '../consts';

import { LocalDbIndexed } from './LocalDbIndexed';

// add indexedDB for node
require('fake-indexeddb/auto');

jest.mock('react-native-uuid', () => ({
  v4() {
    return 'fake-uuid';
  },
}));

describe('LocalDbIndexed tests', () => {
  it('getContext', async () => {
    const db = new LocalDbIndexed();
    // @ts-ignore
    const db0 = await db.readyDb;
    const context = await db.getContext();
    expect(context.id).toEqual(DB_MAIN_CONTEXT_ID);
    expect(context.backupUUID).toEqual('fake-uuid');
    expect(db0.indexed.version).toEqual(INDEXED_DB_VERSION);
  });
  it('getBackupUUID', async () => {
    const db = new LocalDbIndexed();
    const backupUUID = await db.getBackupUUID();
    expect(backupUUID).toEqual('fake-uuid');
  });
  it.skip('dbUpgrade', async () => {
    // TODO thrown: "Exceeded timeout of 5000 ms for a test.

    // @ts-ignore
    // eslint-disable-next-line no-import-assign
    consts.INDEXED_DB_VERSION = 11;

    const db = new LocalDbIndexed();
    // @ts-ignore
    const db0 = await db.readyDb;
    expect(db0.indexed.objectStoreNames).not.toContain('hello');
    expect(db0.indexed.version).toBe(1);

    // @ts-ignore
    // ELocalDBStoreNames.hello = 'hello';
  });
  it.skip('reset', async () => {
    const db = new LocalDbIndexed();

    // TODO thrown: "Exceeded timeout of 5000 ms for a test.
    await db.reset();
    // const context2 = await db.getContext();
  });
});
