const mockRecords = new Map<string, string>();
const mockIsMaskingDataSync = jest.fn(() => false);
const mockExistsMMKV = jest.fn(() => false);
const mockCreateMMKV = jest.fn(() => ({
  getString: (key: string) => mockRecords.get(key),
  remove: (key: string) => mockRecords.delete(key),
  set: (key: string, value: string) => mockRecords.set(key, value),
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: mockCreateMMKV,
  existsMMKV: mockExistsMMKV,
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironment: async () => ({
      persistence: {
        run: <T>({
          operation,
          onBlocked,
        }: {
          operation: () => Promise<T>;
          onBlocked: () => T | Promise<T>;
        }) => (mockIsMaskingDataSync() ? onBlocked() : operation()),
      },
    }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF } =
  require('./consts') as typeof import('./consts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mmkvProfileKeyStorage = require('./mmkvProfileKeyStorage.native')
  .default as typeof import('./mmkvProfileKeyStorage.native').default;
const getOrCreateItem = mmkvProfileKeyStorage.getOrCreateItem!;

describe('MMKV profile-key storage Travel Mode masking', () => {
  beforeEach(() => {
    mockRecords.clear();
    mockCreateMMKV.mockClear();
    mockExistsMMKV.mockReset().mockReturnValue(false);
    mockIsMaskingDataSync.mockReturnValue(false);
  });

  it('reports absence without creating a profile key store during preflight', async () => {
    await expect(
      mmkvProfileKeyStorage.getItem(DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF, true),
    ).resolves.toBeNull();
    expect(mockCreateMMKV).not.toHaveBeenCalled();
  });

  it('masks the default profile key while Travel Mode is active', async () => {
    mockRecords.set(DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF, 'persisted-key');
    mockIsMaskingDataSync.mockReturnValue(true);

    await expect(
      mmkvProfileKeyStorage.getItem(DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF),
    ).rejects.toThrow('MMKV profile key is unavailable');
    await expect(
      getOrCreateItem(
        DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF,
        () => 'replacement-key',
      ),
    ).rejects.toThrow('MMKV profile key is unavailable');
    expect(mockCreateMMKV).not.toHaveBeenCalled();
  });

  it('does not create a missing verifier profile key while masking', async () => {
    const createKeyHex = jest.fn(() => 'new-key');
    mockIsMaskingDataSync.mockReturnValue(true);

    await expect(
      getOrCreateItem(DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF, createKeyHex),
    ).rejects.toThrow('MMKV profile key is unavailable');
    expect(createKeyHex).not.toHaveBeenCalled();
    expect(mockRecords.size).toBe(0);
  });

  it('masks other keys and silently skips writes while masking', async () => {
    mockRecords.set('other-key', 'persisted-key');
    mockIsMaskingDataSync.mockReturnValue(true);

    await expect(mmkvProfileKeyStorage.getItem('other-key')).rejects.toThrow(
      'MMKV profile key is unavailable',
    );
    await expect(getOrCreateItem('other-key', () => 'new-key')).rejects.toThrow(
      'MMKV profile key is unavailable',
    );
    await mmkvProfileKeyStorage.setItem('other-key', 'changed-key');
    await mmkvProfileKeyStorage.removeItem('other-key');

    expect(mockRecords.get('other-key')).toBe('persisted-key');
  });

  it('can read an existing profile key store during the first preflight', async () => {
    mockExistsMMKV.mockReturnValue(true);
    mockRecords.set(DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF, 'persisted-key');
    await expect(
      mmkvProfileKeyStorage.getItem(DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF, true),
    ).resolves.toBe('persisted-key');
    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'onekey-local-secret-envelope',
    });
  });
});
