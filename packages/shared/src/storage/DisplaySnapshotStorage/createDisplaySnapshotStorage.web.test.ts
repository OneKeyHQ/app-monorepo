import { createDisplaySnapshotStorage } from './createDisplaySnapshotStorage.web';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fake-indexeddb/auto');
} catch {
  // IndexedDB integration is skipped when the test polyfill is unavailable.
}

const hasIndexedDB =
  typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
const describeIfIndexedDB = hasIndexedDB ? describe : describe.skip;

describeIfIndexedDB('DisplaySnapshotStorage IndexedDB backend', () => {
  it('commits records atomically and never enumerates during point reads', async () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-web-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    const getAll = jest.spyOn(IDBObjectStore.prototype, 'getAll');
    const getAllKeys = jest.spyOn(IDBObjectStore.prototype, 'getAllKeys');
    await storage.commit({
      entries: [
        { key: 'chunk/a', value: 'a' },
        { key: 'chunk/b', value: 'b' },
      ],
      commitMarker: { key: 'route/a', value: 'generation-1' },
      expectedCommitMarker: { key: 'route/a', value: undefined },
    });
    await expect(storage.read('route/a')).resolves.toBe('generation-1');
    await expect(storage.readMany(['chunk/a', 'chunk/b'])).resolves.toEqual(
      new Map([
        ['chunk/a', 'a'],
        ['chunk/b', 'b'],
      ]),
    );
    expect(getAll).not.toHaveBeenCalled();
    expect(getAllKeys).not.toHaveBeenCalled();
    getAll.mockRestore();
    getAllKeys.mockRestore();
  });

  it('rejects a stale marker without publishing partial data', async () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-web-cas-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    await storage.commit({
      entries: [{ key: 'chunk/a', value: 'old' }],
      commitMarker: { key: 'route/a', value: 'generation-1' },
    });
    await expect(
      storage.commit({
        entries: [{ key: 'chunk/a', value: 'new' }],
        commitMarker: { key: 'route/a', value: 'generation-2' },
        expectedCommitMarker: {
          key: 'route/a',
          value: 'stale-generation',
        },
      }),
    ).rejects.toThrow('marker changed');
    await expect(storage.read('chunk/a')).resolves.toBe('old');
    await expect(storage.read('route/a')).resolves.toBe('generation-1');
  });
});
