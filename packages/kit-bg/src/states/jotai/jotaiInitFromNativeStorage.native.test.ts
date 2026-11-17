/**
 * The UI runtime's own read of the Jotai store.
 *
 * What matters here is when it refuses: hydrating from a file that is not yet
 * the truth would show the user stale or masked state for as long as the
 * background runtime takes to correct it.
 */
import { MMKV_MIGRATION_COMPLETE_KEY } from './jotaiStorageConsts';

const storedValues = new Map<string, string>();
let masking = false;
const jotaiInitFromUi = jest.fn(() => Promise.resolve());

jest.mock(
  '@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance',
  () => ({
    __esModule: true,
    default: {
      getString: (key: string) => storedValues.get(key),
      getNumber: () => undefined,
      getBoolean: () => undefined,
      set: (key: string, value: string) => storedValues.set(key, String(value)),
      remove: (key: string) => storedValues.delete(key),
      clearAll: () => storedValues.clear(),
      getAllKeys: () => [...storedValues.keys()],
    },
  }),
);
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    isMaskingDataSync: () => masking,
    // Importing the real `buildJotaiStorageKey` pulls app storage in behind
    // it, and that reads a setting while it loads.
    getRuntimeEnvironmentSync: () => ({
      persistence: {
        runSync: <T>({ operation }: { operation: () => T }) => operation(),
      },
    }),
  },
}));
jest.mock('./jotaiInitFromUi', () => ({
  jotaiInitFromUi: (...args: unknown[]) => jotaiInitFromUi(...(args as [])),
}));

async function loadSubject() {
  const platform = (await import('@onekeyhq/shared/src/platformEnv')).default;
  platform.isNativeMainThread = true;
  platform.isNativeBackgroundThread = false;
  const { hydrateJotaiFromNativeStorage } =
    await import('./jotaiInitFromNativeStorage.native');
  return hydrateJotaiFromNativeStorage;
}

describe('hydrateJotaiFromNativeStorage', () => {
  beforeEach(() => {
    jest.resetModules();
    storedValues.clear();
    masking = false;
    jotaiInitFromUi.mockClear();
  });

  it('injects the persisted atoms it finds', async () => {
    storedValues.set(MMKV_MIGRATION_COMPLETE_KEY, '1');
    storedValues.set(
      'g_states_v5:settingsPersistAtom',
      JSON.stringify({ theme: 'dark' }),
    );
    const hydrate = await loadSubject();

    const result = await hydrate();

    expect(result).toEqual({ hydrated: true, atomCount: 1 });
    expect(jotaiInitFromUi).toHaveBeenCalledWith({
      states: { settingsPersistAtom: { theme: 'dark' } },
      useSnapshotInjection: true,
    });
  });

  it('refuses a store that has not finished migrating off AsyncStorage', async () => {
    storedValues.set(
      'g_states_v5:settingsPersistAtom',
      JSON.stringify({ theme: 'dark' }),
    );
    const hydrate = await loadSubject();

    // The values are there, but bg has not published them yet.
    expect(await hydrate()).toEqual({
      hydrated: false,
      atomCount: 0,
      reason: 'not-migrated',
    });
    expect(jotaiInitFromUi).not.toHaveBeenCalled();
  });

  it('refuses while Travel Mode is masking, where bg decides what may be read', async () => {
    storedValues.set(MMKV_MIGRATION_COMPLETE_KEY, '1');
    storedValues.set(
      'g_states_v5:settingsPersistAtom',
      JSON.stringify({ theme: 'dark' }),
    );
    masking = true;
    const hydrate = await loadSubject();

    expect(await hydrate()).toEqual({
      hydrated: false,
      atomCount: 0,
      reason: 'travel-mode',
    });
    expect(jotaiInitFromUi).not.toHaveBeenCalled();
  });

  it('reports an empty store rather than injecting nothing', async () => {
    storedValues.set(MMKV_MIGRATION_COMPLETE_KEY, '1');
    const hydrate = await loadSubject();

    expect(await hydrate()).toEqual({
      hydrated: false,
      atomCount: 0,
      reason: 'empty',
    });
    expect(jotaiInitFromUi).not.toHaveBeenCalled();
  });

  it('skips the atoms it cannot parse and keeps the rest', async () => {
    storedValues.set(MMKV_MIGRATION_COMPLETE_KEY, '1');
    storedValues.set('g_states_v5:settingsPersistAtom', '{not json');
    storedValues.set('g_states_v5:currencyPersistAtom', JSON.stringify('usd'));
    const hydrate = await loadSubject();

    expect(await hydrate()).toEqual({ hydrated: true, atomCount: 1 });
    expect(jotaiInitFromUi).toHaveBeenCalledWith({
      states: { currencyPersistAtom: 'usd' },
      useSnapshotInjection: true,
    });
  });
});
