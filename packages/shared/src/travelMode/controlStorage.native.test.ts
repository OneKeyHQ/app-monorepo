const mockSharedValues = new Map<string, string | number | boolean>();
const mockSharedStore = {
  get: jest.fn((key: string) => mockSharedValues.get(key)),
  set: jest.fn((key: string, value: number) => {
    mockSharedValues.set(key, value);
  }),
};
const mockGetSharedStore = jest.fn(() => mockSharedStore);

jest.mock(
  '../modules3rdParty/react-native-background-thread/sharedStore',
  () => ({
    getBackgroundThreadSharedStore: mockGetSharedStore,
  }),
);
jest.mock('../storage/instance/nativeSyncStorageParts', () => ({
  createNativeSettingsSyncStorage: () => ({ getString: jest.fn() }),
}));
jest.mock('../storage/nativeStorageMigrationModule', () => ({
  syncNativeStorageMMKV: jest.fn(),
}));

describe('native Travel Mode runtime generation', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSharedValues.clear();
    jest.clearAllMocks();
  });

  it('reads one native generation from independent main/bg storage adapters', async () => {
    const platform = (await import('../platformEnv')).default;
    platform.isNativeBackgroundThread = true;
    platform.isNativeMainThread = false;
    const background = (await import('./controlStorage.native')).default;
    jest.resetModules();
    const mainPlatform = (await import('../platformEnv')).default;
    mainPlatform.isNativeBackgroundThread = false;
    mainPlatform.isNativeMainThread = true;
    const main = (await import('./controlStorage.native')).default;

    expect(main).not.toBe(background);
    expect(main).toHaveProperty('setRuntimeGenerationSync', undefined);
    expect(main.getRuntimeGenerationSync?.()).toBe(0);
    background.setRuntimeGenerationSync?.(2);
    expect(main.getRuntimeGenerationSync?.()).toBe(2);
    expect(background.getRuntimeGenerationSync?.()).toBe(2);
  });
});
