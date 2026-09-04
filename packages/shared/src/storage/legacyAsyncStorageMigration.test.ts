/* eslint-disable @typescript-eslint/no-unsafe-call, onekey/no-raw-error */

const mockPlatformEnv = {
  isNativeAndroid: true,
  isNativeBackgroundThread: true,
  isNativeIOS: false,
};
const mockRawModule = {
  getAllKeys: jest.fn(async () => [] as string[]),
  multiGet: jest.fn(
    async (keys: string[]): Promise<Array<[string, string | null]>> =>
      keys.map((key) => [key, `raw:${key}`]),
  ),
  multiRemove: jest.fn(async () => undefined),
  multiSet: jest.fn(async () => undefined),
  reloadManifest: jest.fn(async () => undefined),
};
const mockChunkedRead = jest.fn(
  async (key: string): Promise<string | null> => `chunked:${key}`,
);

jest.mock('react-native', () => ({
  TurboModuleRegistry: {
    getEnforcing: jest.fn(() => mockRawModule),
  },
}));
jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));
jest.mock('./nativeStorageMigrationModule', () => ({
  readLegacyAsyncStorageValueChunked: mockChunkedRead,
}));

function createLegacyAdapter() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (
    require('./legacyAsyncStorageMigration') as typeof import('./legacyAsyncStorageMigration')
  ).getLegacyAsyncStorageForMigration();
}

describe('legacyAsyncStorageMigration Android oversized rows', () => {
  beforeEach(() => {
    mockPlatformEnv.isNativeAndroid = true;
    mockPlatformEnv.isNativeBackgroundThread = true;
    mockPlatformEnv.isNativeIOS = false;
    mockRawModule.multiGet.mockImplementation(
      async (keys: string[]): Promise<Array<[string, string | null]>> =>
        keys.map((key) => [key, `raw:${key}`]),
    );
    mockChunkedRead.mockImplementation(
      async (key: string): Promise<string | null> => `chunked:${key}`,
    );
    jest.clearAllMocks();
  });

  it('uses the normal TurboModule batch path when rows fit', async () => {
    const adapter = createLegacyAdapter();

    await expect(adapter.multiGet(['a', 'b'])).resolves.toEqual([
      ['a', 'raw:a'],
      ['b', 'raw:b'],
    ]);
    expect(mockChunkedRead).not.toHaveBeenCalled();
  });

  it('falls back to bounded native chunks for CursorWindow failures', async () => {
    mockRawModule.multiGet.mockRejectedValueOnce(
      new Error('Row too big to fit into CursorWindow'),
    );
    mockChunkedRead.mockResolvedValueOnce(null);
    const adapter = createLegacyAdapter();

    await expect(adapter.multiGet(['missing', 'large'])).resolves.toEqual([
      ['missing', null],
      ['large', 'chunked:large'],
    ]);
    expect(mockChunkedRead).toHaveBeenCalledTimes(2);
  });

  it('does not hide unrelated legacy database failures', async () => {
    mockRawModule.multiGet.mockRejectedValueOnce(
      new Error('database disk image is malformed'),
    );
    const adapter = createLegacyAdapter();

    await expect(adapter.multiGet(['a'])).rejects.toThrow(
      'database disk image is malformed',
    );
    expect(mockChunkedRead).not.toHaveBeenCalled();
  });

  it('never activates the Android fallback on other platforms', async () => {
    mockPlatformEnv.isNativeAndroid = false;
    mockRawModule.multiGet.mockRejectedValueOnce(
      new Error('Row too big to fit into CursorWindow'),
    );
    const adapter = createLegacyAdapter();

    await expect(adapter.multiGet(['a'])).rejects.toThrow('Row too big');
    expect(mockChunkedRead).not.toHaveBeenCalled();
  });

  it('reloads the iOS manifest before every raw storage operation', async () => {
    mockPlatformEnv.isNativeAndroid = false;
    mockPlatformEnv.isNativeIOS = true;
    const adapter = createLegacyAdapter();

    await adapter.getAllKeys();
    await adapter.multiGet(['a']);
    await adapter.multiSet([['a', 'value']]);
    await adapter.multiRemove(['a']);

    expect(mockRawModule.reloadManifest).toHaveBeenCalledTimes(4);
    expect(
      mockRawModule.reloadManifest.mock.invocationCallOrder[0],
    ).toBeLessThan(mockRawModule.getAllKeys.mock.invocationCallOrder[0]);
    expect(
      mockRawModule.reloadManifest.mock.invocationCallOrder[1],
    ).toBeLessThan(mockRawModule.multiGet.mock.invocationCallOrder[0]);
    expect(
      mockRawModule.reloadManifest.mock.invocationCallOrder[2],
    ).toBeLessThan(mockRawModule.multiSet.mock.invocationCallOrder[0]);
    expect(
      mockRawModule.reloadManifest.mock.invocationCallOrder[3],
    ).toBeLessThan(mockRawModule.multiRemove.mock.invocationCallOrder[0]);
  });
});
