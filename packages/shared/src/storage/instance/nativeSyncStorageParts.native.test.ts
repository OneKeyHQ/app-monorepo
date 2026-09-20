/**
 * Main's pre-bootstrap read path.
 *
 * The ordering here is the whole point and it is easy to get backwards. The
 * file may only answer while the mirror still holds nothing: once bg has
 * replied, the mirror is the one that knows about this runtime's own writes
 * and deletions, and preferring the file would serve a value the user has
 * already changed.
 */
const fileValues = new Map<string, string>();
const mirrorValues = new Map<string, string>();
let mirrorBootstrapped = false;
let travelModeMasking = false;

function createFakeInstance(values: Map<string, string>) {
  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, String(value)),
    remove: (key: string) => values.delete(key),
    clearAll: () => values.clear(),
    getAllKeys: () => [...values.keys()],
  };
}

jest.mock('./coldStartCacheMMKVInstance', () => ({
  __esModule: true,
  default: createFakeInstance(fileValues),
}));
jest.mock('./mmkvStorageInstance', () => ({
  __esModule: true,
  default: createFakeInstance(fileValues),
}));
jest.mock('./nativeSyncStorageMirror', () => ({
  createNativeSyncStorageMirror: () => createFakeInstance(mirrorValues),
  isNativeSyncStorageMirrorBootstrapped: () => mirrorBootstrapped,
}));
jest.mock('../../travelMode', () => ({
  travelModeManager: { isMaskingDataSync: () => travelModeMasking },
}));

describe('native cold-start storage reads on main', () => {
  beforeEach(async () => {
    jest.resetModules();
    fileValues.clear();
    mirrorValues.clear();
    mirrorBootstrapped = false;
    travelModeMasking = false;
    const platform = (await import('../../platformEnv')).default;
    platform.isNativeBackgroundThread = false;
    platform.isNativeMainThread = true;
  });

  async function createStorage() {
    const { createNativeColdStartCacheStorage } = await import(
      './nativeSyncStorageParts.native'
    );
    return createNativeColdStartCacheStorage();
  }

  it('answers from the file while the mirror is still empty', async () => {
    fileValues.set('k', 'from-file');
    const storage = await createStorage();

    expect(storage.getString('k' as never)).toBe('from-file');
  });

  it('prefers the mirror once bg has answered, so local writes are not lost', async () => {
    fileValues.set('k', 'stale-on-disk');
    mirrorValues.set('k', 'written-by-main');
    const storage = await createStorage();

    mirrorBootstrapped = true;

    expect(storage.getString('k' as never)).toBe('written-by-main');
  });

  it('does not resurrect a key the mirror no longer has after bootstrap', async () => {
    fileValues.set('k', 'stale-on-disk');
    const storage = await createStorage();

    // Deleted through the mirror; the file has not caught up yet.
    mirrorBootstrapped = true;

    expect(storage.getString('k' as never)).toBeUndefined();
  });

  it('leaves the fast path alone while Travel Mode is masking', async () => {
    fileValues.set('k', 'real-data');
    travelModeMasking = true;
    const storage = await createStorage();

    // Masking is bg's job, so the read waits for the mirror bg fills.
    expect(storage.getString('k' as never)).toBeUndefined();
  });

  it('falls back to the mirror when the file has nothing for the key', async () => {
    mirrorValues.set('k', 'from-mirror');
    const storage = await createStorage();

    expect(storage.getString('k' as never)).toBe('from-mirror');
  });
});
