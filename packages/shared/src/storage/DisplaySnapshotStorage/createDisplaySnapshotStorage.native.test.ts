import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '../../errors';

import { createDisplaySnapshotStorage } from './createDisplaySnapshotStorage.native';

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => {
    const globalState = globalThis as typeof globalThis & {
      __displaySnapshotMMKVTestState?: {
        values: Map<string, string>;
        operations: string[];
      };
    };
    const state =
      globalState.__displaySnapshotMMKVTestState ??
      (globalState.__displaySnapshotMMKVTestState = {
        values: new Map<string, string>(),
        operations: [],
      });
    return {
      getString(key: string) {
        state.operations.push(`get:${key}`);
        return state.values.get(key);
      },
      set(key: string, value: string) {
        state.operations.push(`set:${key}`);
        state.values.set(key, value);
      },
      remove(key: string) {
        state.operations.push(`remove:${key}`);
        state.values.delete(key);
      },
      clearAll() {
        state.operations.push('clear');
        state.values.clear();
      },
      trim() {
        state.operations.push('trim');
      },
    };
  }),
}));

const mockCreateMMKV = createMMKV as jest.MockedFunction<typeof createMMKV>;

function getMockState() {
  const globalState = globalThis as typeof globalThis & {
    __displaySnapshotMMKVTestState?: {
      values: Map<string, string>;
      operations: string[];
    };
  };
  if (!globalState.__displaySnapshotMMKVTestState) {
    globalState.__displaySnapshotMMKVTestState = {
      values: new Map<string, string>(),
      operations: [],
    };
  }
  return globalState.__displaySnapshotMMKVTestState;
}

describe('DisplaySnapshotStorage MMKV backend', () => {
  beforeEach(() => {
    const state = getMockState();
    state.values.clear();
    state.operations.length = 0;
    mockCreateMMKV.mockClear();
  });

  it('creates one dedicated instance lazily and publishes the marker last synchronously', () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-native-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    expect(mockCreateMMKV).not.toHaveBeenCalled();
    expect(
      storage.commit({
        entries: [
          { key: 'chunk/a', value: 'a' },
          { key: 'manifest/a', value: 'manifest' },
        ],
        commitMarker: { key: 'route/a', value: 'generation-1' },
        expectedCommitMarker: { key: 'route/a', value: undefined },
        removeKeys: ['manifest/retired'],
      }),
    ).toBeUndefined();
    expect(storage.read('route/a')).toBe('generation-1');
    expect(storage.readMany(['chunk/a'])).toEqual(new Map([['chunk/a', 'a']]));
    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'onekey-display-snapshot-home-native-test',
    });
    expect(getMockState().operations).toEqual([
      'get:route/a',
      // Removals precede the writes and the marker: see the resurrection
      // test below for why the order is load-bearing.
      'remove:manifest/retired',
      'set:chunk/a',
      'set:manifest/a',
      'set:route/a',
      'get:route/a',
      'get:chunk/a',
    ]);
  });

  /**
   * `get()` reads a record by key and never consults the manifest, so the
   * physical record must not outlive the manifest entry that deleted it —
   * otherwise a wallet the user removed is still served on the next launch.
   */
  it('removes the record before the marker, so a kill between them cannot revive it', () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-native-kill-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    storage.commit({
      entries: [{ key: 'd:wallet-list', value: 'stale-wallets' }],
      commitMarker: { key: 'manifest', value: 'generation-1' },
    });
    expect(storage.read('d:wallet-list')).toBe('stale-wallets');

    const state = getMockState();
    state.operations.length = 0;
    // The process dies once the new manifest is about to be published.
    const realSet = state.values.set.bind(state.values);
    let killed = false;
    jest
      .spyOn(state.values, 'set')
      .mockImplementation((key: string, value: string) => {
        if (key === 'manifest') {
          killed = true;
          throw new OneKeyLocalError('process killed before the marker landed');
        }
        return realSet(key, value);
      });

    expect(() =>
      storage.commit({
        entries: [],
        commitMarker: { key: 'manifest', value: 'generation-2' },
        removeKeys: ['d:wallet-list'],
      }),
    ).toThrow();
    jest.restoreAllMocks();

    expect(killed).toBe(true);
    // The manifest still names the record, but the record is already gone,
    // so the read is a miss rather than a resurrected wallet list.
    expect(storage.read('manifest')).toBe('generation-1');
    expect(storage.read('d:wallet-list')).toBeUndefined();
    expect(state.operations[0]).toBe('remove:d:wallet-list');
  });

  it('does not write data when its route marker expectation is stale', () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-native-cas-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    storage.commit({
      entries: [{ key: 'chunk/a', value: 'old' }],
      commitMarker: { key: 'route/a', value: 'generation-1' },
    });
    getMockState().operations.length = 0;
    expect(() =>
      storage.commit({
        entries: [{ key: 'chunk/a', value: 'new' }],
        commitMarker: { key: 'route/a', value: 'generation-2' },
        expectedCommitMarker: {
          key: 'route/a',
          value: 'stale-generation',
        },
      }),
    ).toThrow('marker changed');
    expect(getMockState().operations).toEqual(['get:route/a']);
    expect(getMockState().values.get('chunk/a')).toBe('old');
    expect(getMockState().values.get('route/a')).toBe('generation-1');
  });

  it('trims only when compaction is requested explicitly', () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-native-trim-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    storage.remove(['chunk/retired']);
    expect(getMockState().operations).toEqual(['remove:chunk/retired']);
    storage.compact();
    expect(getMockState().operations).toEqual(['remove:chunk/retired', 'trim']);
  });
});
