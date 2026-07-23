import { createMMKV } from 'react-native-mmkv';

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

  it('creates one dedicated instance lazily and publishes the marker last', async () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-native-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    expect(mockCreateMMKV).not.toHaveBeenCalled();
    await storage.commit({
      entries: [
        { key: 'chunk/a', value: 'a' },
        { key: 'manifest/a', value: 'manifest' },
      ],
      commitMarker: { key: 'route/a', value: 'generation-1' },
      expectedCommitMarker: { key: 'route/a', value: undefined },
      removeKeys: ['manifest/retired'],
    });
    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'onekey-display-snapshot-home-native-test',
    });
    expect(getMockState().operations).toEqual([
      'get:route/a',
      'set:chunk/a',
      'set:manifest/a',
      'set:route/a',
      'remove:manifest/retired',
    ]);
  });

  it('does not write data when its route marker expectation is stale', async () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-native-cas-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    await storage.commit({
      entries: [{ key: 'chunk/a', value: 'old' }],
      commitMarker: { key: 'route/a', value: 'generation-1' },
    });
    getMockState().operations.length = 0;
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
    expect(getMockState().operations).toEqual(['get:route/a']);
    expect(getMockState().values.get('chunk/a')).toBe('old');
    expect(getMockState().values.get('route/a')).toBe('generation-1');
  });

  it('trims only when compaction is requested explicitly', async () => {
    const storage = createDisplaySnapshotStorage({
      namespace: 'home-native-trim-test',
      maxRecordBytes: 128,
      maxReadBatchSize: 4,
    });
    await storage.remove(['chunk/retired']);
    expect(getMockState().operations).toEqual(['remove:chunk/retired']);
    await storage.compact();
    expect(getMockState().operations).toEqual(['remove:chunk/retired', 'trim']);
  });
});
