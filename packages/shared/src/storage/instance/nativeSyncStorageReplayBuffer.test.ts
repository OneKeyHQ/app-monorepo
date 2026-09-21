import { appendCompactedLocalMutation } from './nativeSyncStorageReplayBuffer';

import type { INativeSyncStorageLocalMutation } from '../nativeStorageTypes';

describe('native sync storage replay compaction', () => {
  it('keeps final SWR values and deletion tombstones without dropping unrelated keys', () => {
    const mutations: INativeSyncStorageLocalMutation[] = [];
    const changes: INativeSyncStorageLocalMutation[] = [
      {
        operation: 'patchSWR',
        entries: [
          ['a', 'old'],
          ['b', 'retained'],
        ],
      },
      { operation: 'set', key: 'setting', value: true },
      {
        operation: 'patchSWR',
        entries: [
          ['a', null],
          ['c', 'new'],
        ],
      },
    ];
    changes.forEach((mutation) =>
      expect(appendCompactedLocalMutation(mutations, mutation)).toBe(true),
    );
    expect(mutations).toEqual([
      { operation: 'set', key: 'setting', value: true },
      {
        operation: 'patchSWR',
        entries: [
          ['a', null],
          ['b', 'retained'],
          ['c', 'new'],
        ],
      },
    ]);
  });

  it('preserves clear, whole-cache replacement and removal ordering', () => {
    const mutations: INativeSyncStorageLocalMutation[] = [];
    const changes: INativeSyncStorageLocalMutation[] = [
      { operation: 'patchSWR', entries: [['old', 'value']] },
      { operation: 'set', key: 'onekey_swr_cache', value: '{}' },
      { operation: 'patchSWR', entries: [['new', 'value']] },
    ];
    changes.forEach((mutation) =>
      appendCompactedLocalMutation(mutations, mutation),
    );
    expect(mutations).toEqual(changes.slice(1));
    appendCompactedLocalMutation(mutations, {
      operation: 'remove',
      key: 'onekey_swr_cache',
    });
    expect(mutations).toEqual([
      { operation: 'remove', key: 'onekey_swr_cache' },
    ]);
    appendCompactedLocalMutation(mutations, { operation: 'clear' });
    appendCompactedLocalMutation(mutations, {
      operation: 'patchSWR',
      entries: [['after-clear', 'value']],
    });
    expect(mutations).toEqual([
      { operation: 'clear' },
      { operation: 'patchSWR', entries: [['after-clear', 'value']] },
    ]);
  });

  it('rejects too many distinct SWR entries including deletion tombstones', () => {
    const mutations: INativeSyncStorageLocalMutation[] = [
      {
        operation: 'patchSWR',
        entries: Array.from({ length: 1000 }, (_, index) => [
          `key-${index}`,
          null,
        ]),
      },
    ];
    expect(
      appendCompactedLocalMutation(mutations, {
        operation: 'patchSWR',
        entries: [['overflow', null]],
      }),
    ).toBe(false);
    expect(mutations).toHaveLength(1);
    expect(
      appendCompactedLocalMutation(mutations, {
        operation: 'patchSWR',
        entries: [['key-0', 'replacement']],
      }),
    ).toBe(true);
  });

  it('rejects oversized replay payloads before changing the buffer', () => {
    const mutations: INativeSyncStorageLocalMutation[] = [];
    expect(
      appendCompactedLocalMutation(mutations, {
        operation: 'patchSWR',
        entries: [['key', 'x'.repeat(10 * 1024 * 1024)]],
      }),
    ).toBe(false);
    expect(mutations).toEqual([]);
  });
});
