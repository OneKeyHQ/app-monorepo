/**
 * How each native store answers a read on the main runtime.
 *
 * Settings are bg-owned, so main keeps a mirror and the file may only answer
 * while that mirror is still empty — the ordering there is easy to get
 * backwards, and preferring the file after bootstrap would serve a value the
 * user has already changed.
 *
 * The cold-start cache is owned by whoever is reading it: main works the file
 * itself, and the mirror is not in the path at all.
 */
const fileValues = new Map<string, string>();
const coldStartFileValues = new Map<string, string>();
const mirrorValues = new Map<string, string>();
let mirrorBootstrapped = false;
let travelModeMasking = false;

function createFakeInstance(values: Map<string, string>) {
  return {
    getString: (key: string) => values.get(key),
    getNumber: () => undefined,
    getBoolean: () => undefined,
    set: (key: string, value: string) => values.set(key, String(value)),
    remove: (key: string) => values.delete(key),
    clearAll: () => values.clear(),
    getAllKeys: () => [...values.keys()],
  };
}

jest.mock('./coldStartCacheMMKVInstance', () => ({
  __esModule: true,
  default: createFakeInstance(coldStartFileValues),
}));
jest.mock('./mmkvStorageInstance', () => ({
  __esModule: true,
  default: createFakeInstance(fileValues),
}));
jest.mock('./nativeSyncStorageMirror', () => ({
  createNativeSyncStorageMirror: () => createFakeInstance(mirrorValues),
  isNativeSyncStorageMirrorBootstrapped: () => mirrorBootstrapped,
}));
jest.mock('../travelModeMaskingGate', () => ({
  isTravelModeMaskingSync: () => travelModeMasking,
}));

describe('native sync storage reads on main', () => {
  beforeEach(async () => {
    jest.resetModules();
    fileValues.clear();
    coldStartFileValues.clear();
    mirrorValues.clear();
    mirrorBootstrapped = false;
    travelModeMasking = false;
    const platform = (await import('../../platformEnv')).default;
    platform.isNativeBackgroundThread = false;
    platform.isNativeMainThread = true;
  });

  async function createSettingsStorage() {
    const { createNativeSettingsSyncStorage } =
      await import('./nativeSyncStorageParts.native');
    return createNativeSettingsSyncStorage();
  }

  async function createColdStartStorage() {
    const { createNativeColdStartCacheStorage } =
      await import('./nativeSyncStorageParts.native');
    return createNativeColdStartCacheStorage();
  }

  describe('settings', () => {
    it('answers from the file while the mirror is still empty', async () => {
      fileValues.set('k', 'from-file');
      const storage = await createSettingsStorage();

      expect(storage.getString('k' as never)).toBe('from-file');
    });

    it('prefers the mirror once bg has answered, so local writes are not lost', async () => {
      fileValues.set('k', 'stale-on-disk');
      mirrorValues.set('k', 'written-by-main');
      const storage = await createSettingsStorage();

      mirrorBootstrapped = true;

      expect(storage.getString('k' as never)).toBe('written-by-main');
    });

    it('does not resurrect a key the mirror no longer has after bootstrap', async () => {
      fileValues.set('k', 'stale-on-disk');
      const storage = await createSettingsStorage();

      // Deleted through the mirror; the file has not caught up yet.
      mirrorBootstrapped = true;

      expect(storage.getString('k' as never)).toBeUndefined();
    });

    it('leaves the fast path alone while Travel Mode is masking', async () => {
      fileValues.set('k', 'real-data');
      travelModeMasking = true;
      const storage = await createSettingsStorage();

      // Masking is bg's job, so the read waits for the mirror bg fills.
      expect(storage.getString('k' as never)).toBeUndefined();
    });

    it('falls back to the mirror when the file has nothing for the key', async () => {
      mirrorValues.set('k', 'from-mirror');
      const storage = await createSettingsStorage();

      expect(storage.getString('k' as never)).toBe('from-mirror');
    });
  });

  describe('cold-start cache', () => {
    it('reads the file even after the mirror is bootstrapped', async () => {
      coldStartFileValues.set('k', 'from-file');
      mirrorValues.set('k', 'from-mirror');
      mirrorBootstrapped = true;
      const storage = await createColdStartStorage();

      expect(storage.getString('k' as never)).toBe('from-file');
    });

    it('writes to the file rather than posting them to bg', async () => {
      const storage = await createColdStartStorage();

      void storage.set('k' as never, 'written-by-main');

      expect(coldStartFileValues.get('k')).toBe('written-by-main');
      expect(mirrorValues.size).toBe(0);
    });

    it('is inert and empties the file while Travel Mode is masking', async () => {
      coldStartFileValues.set('k', 'from-the-launch-before');
      travelModeMasking = true;
      const storage = await createColdStartStorage();

      expect(coldStartFileValues.size).toBe(0);
      void storage.set('k' as never, 'written-while-masked');
      expect(storage.getString('k' as never)).toBeUndefined();
      expect(coldStartFileValues.size).toBe(0);
    });
  });
});
