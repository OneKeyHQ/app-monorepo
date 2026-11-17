import { createDisplaySnapshotStorageCore } from './createDisplaySnapshotStorageCore';

import type {
  IDisplaySnapshotCommit,
  IDisplaySnapshotStorageBackend,
} from './types';

function createMemoryBackend() {
  const values = new Map<string, string>();
  const operations: string[] = [];
  const backend: IDisplaySnapshotStorageBackend = {
    async read(key) {
      operations.push(`read:${key}`);
      return values.get(key);
    },
    async readMany(keys) {
      operations.push(`readMany:${keys.join(',')}`);
      return new Map(
        keys.flatMap((key) => {
          const value = values.get(key);
          return value === undefined ? [] : [[key, value]];
        }),
      );
    },
    async commit(input) {
      input.entries.forEach(({ key, value }) => {
        operations.push(`write:${key}`);
        values.set(key, value);
      });
      operations.push(`marker:${input.commitMarker.key}`);
      values.set(input.commitMarker.key, input.commitMarker.value);
      input.removeKeys?.forEach((key) => {
        operations.push(`remove:${key}`);
        values.delete(key);
      });
    },
    async remove(keys) {
      keys.forEach((key) => values.delete(key));
    },
    async clearNamespace() {
      values.clear();
    },
    async compact() {
      operations.push('compact');
    },
  };
  return { backend, operations, values };
}

describe('DisplaySnapshotStorage core', () => {
  it('loads its backend lazily and only reads explicitly requested keys', async () => {
    const memory = createMemoryBackend();
    let loadCount = 0;
    const storage = createDisplaySnapshotStorageCore(
      {
        namespace: 'home-test',
        maxRecordBytes: 32,
        maxReadBatchSize: 2,
      },
      async () => {
        loadCount += 1;
        return memory.backend;
      },
    );
    expect(loadCount).toBe(0);
    await storage.commit({
      entries: [
        { key: 'chunk/a', value: 'a' },
        { key: 'chunk/b', value: 'b' },
      ],
      commitMarker: { key: 'route/a', value: '1' },
    });
    expect(loadCount).toBe(1);
    await expect(storage.readMany(['chunk/a', 'chunk/b'])).resolves.toEqual(
      new Map([
        ['chunk/a', 'a'],
        ['chunk/b', 'b'],
      ]),
    );
    expect(memory.operations).toEqual([
      'write:chunk/a',
      'write:chunk/b',
      'marker:route/a',
      'readMany:chunk/a,chunk/b',
    ]);
  });

  it('serializes explicit compaction with other mutations', async () => {
    const memory = createMemoryBackend();
    const storage = createDisplaySnapshotStorageCore(
      {
        namespace: 'home-test',
        maxRecordBytes: 32,
        maxReadBatchSize: 2,
      },
      async () => memory.backend,
    );
    await storage.compact();
    expect(memory.operations).toEqual(['compact']);
  });

  it('rejects invalid, oversized, duplicate, and unbounded inputs', async () => {
    const memory = createMemoryBackend();
    const storage = createDisplaySnapshotStorageCore(
      {
        namespace: 'home-test',
        maxRecordBytes: 4,
        maxReadBatchSize: 2,
      },
      async () => memory.backend,
    );
    await expect(storage.read('bad key')).rejects.toThrow(
      'Invalid display snapshot key',
    );
    await expect(storage.readMany(['a', 'a'])).rejects.toThrow('duplicates');
    await expect(storage.readMany(['a', 'b', 'c'])).rejects.toThrow(
      'exceeds 2 keys',
    );
    await expect(
      storage.commit({
        entries: [{ key: 'chunk/a', value: '12345' }],
        commitMarker: { key: 'route/a', value: '1' },
      }),
    ).rejects.toThrow('exceeds 4 bytes');
  });

  it('serializes overlapping mutations', async () => {
    const memory = createMemoryBackend();
    let releaseFirst: (() => void) | undefined;
    let markFirstStarted: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let commitCount = 0;
    memory.backend.commit = async (input: IDisplaySnapshotCommit) => {
      commitCount += 1;
      if (commitCount === 1) {
        markFirstStarted?.();
        await firstBlocked;
      }
      input.entries.forEach(({ key, value }) => {
        memory.values.set(key, value);
      });
      memory.values.set(input.commitMarker.key, input.commitMarker.value);
    };
    const storage = createDisplaySnapshotStorageCore(
      {
        namespace: 'home-test',
        maxRecordBytes: 32,
        maxReadBatchSize: 2,
      },
      async () => memory.backend,
    );
    const first = storage.commit({
      entries: [{ key: 'chunk/a', value: 'a' }],
      commitMarker: { key: 'route/a', value: '1' },
    });
    const second = storage.commit({
      entries: [{ key: 'chunk/a', value: 'b' }],
      commitMarker: { key: 'route/a', value: '2' },
    });
    await firstStarted;
    expect(commitCount).toBe(1);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(memory.values.get('chunk/a')).toBe('b');
    expect(memory.values.get('route/a')).toBe('2');
  });
});
