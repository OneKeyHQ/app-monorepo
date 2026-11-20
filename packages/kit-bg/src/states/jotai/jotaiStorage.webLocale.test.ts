import 'fake-indexeddb/auto';
import { createStore } from 'jotai/vanilla';

import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import WebStorage, {
  EWebStorageKeyPrefix,
} from '@onekeyhq/shared/src/storage/WebStorage';

import { EAtomNames } from './atomNames';
import {
  atomWithStorage,
  onekeyJotaiStorage,
  updateWebAppLocalePreference,
  withExplicitWebLocaleUpdate,
} from './jotaiStorage';
import { SETTINGS_CONTROL_STORAGE_KEY } from './jotaiStorageConsts';
import { JOTAI_RESET } from './types';
import { wrapAtomPro } from './utils/wrapAtomPro';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isRuntimeBrowser: true },
}));

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => {
  const { default: Storage, EWebStorageKeyPrefix: prefix } = jest.requireActual<
    typeof import('@onekeyhq/shared/src/storage/WebStorage')
  >('@onekeyhq/shared/src/storage/WebStorage');
  return {
    storageHub: {
      $webStorageGlobalStates: new Storage({
        dbName: 'cross-tab-settings',
        bucketName: 'fixture',
        tableName: 'settings',
        legacyKeyPrefix: prefix.GlobalStates,
      }),
    },
  };
});

jest.mock('@onekeyhq/shared/src/storage/appStorageUtils', () => ({
  __esModule: true,
  default: { canSaveAsObject: () => false },
}));

function scenario() {
  const store = createStore();
  const initial = { locale: 'en-US', theme: 'light' };
  const settings = atomWithStorage(
    EAtomNames.settingsPersistAtom,
    initial,
  ) as unknown as Parameters<typeof wrapAtomPro>[1];
  settings.initialValue = initial;
  const wallet = wrapAtomPro(EAtomNames.settingsPersistAtom, settings);
  const other = new WebStorage({
    dbName: 'cross-tab-settings',
    bucketName: 'fixture',
    tableName: 'settings',
    legacyKeyPrefix: EWebStorageKeyPrefix.GlobalStates,
  });

  return { store, wallet, other, initial };
}

const key = SETTINGS_CONTROL_STORAGE_KEY;

beforeEach(async () => {
  await storageHub.$webStorageGlobalStates?.removeItem(key);
});

it.each([true, false])(
  'preserves locale across functional=%s and direct wallet writes',
  async (functional) => {
    const { store, wallet, other, initial } = scenario();
    try {
      await other.setItem(key, JSON.stringify(initial), undefined);
      await updateWebAppLocalePreference('ja-JP');

      await expect(other.getItem(key, undefined)).resolves.toBe(
        JSON.stringify({ locale: 'ja-JP', theme: 'light' }),
      );
      const changeTheme = (prev: typeof initial) => ({
        ...prev,
        theme: 'dark',
      });
      await store.set(wallet, functional ? changeTheme : changeTheme(initial));
      await expect(other.getItem(key, undefined)).resolves.toBe(
        JSON.stringify({ locale: 'ja-JP', theme: 'dark' }),
      );
    } finally {
      (await other.indexed).close();
    }
  },
);

test('wallet can deliberately select the same locale as its stale cache', async () => {
  const { store, wallet, other, initial } = scenario();
  try {
    await other.setItem(
      key,
      JSON.stringify({ locale: 'ja-JP', theme: 'dark' }),
      undefined,
    );

    await store.set(wallet, (prev: typeof initial) =>
      withExplicitWebLocaleUpdate(prev, 'en-US'),
    );

    await expect(other.getItem(key, undefined)).resolves.toBe(
      JSON.stringify({ locale: 'en-US', theme: 'dark' }),
    );
  } finally {
    (await other.indexed).close();
  }
});

test('explicit wallet reset keeps the existing reset semantics', async () => {
  const { store, wallet, other, initial } = scenario();
  try {
    await other.setItem(
      key,
      JSON.stringify({ locale: 'ja-JP', theme: 'dark' }),
      undefined,
    );
    await store.set(wallet, JOTAI_RESET);
    await expect(other.getItem(key, undefined)).resolves.toBe(
      JSON.stringify(initial),
    );
  } finally {
    (await other.indexed).close();
  }
});

test('startup direct storage seeding preserves a locale already picked in another tab', async () => {
  const { other, initial } = scenario();
  try {
    await updateWebAppLocalePreference('ja-JP');
    await onekeyJotaiStorage.setItem(key, initial);
    await expect(other.getItem(key, undefined)).resolves.toEqual({
      locale: 'ja-JP',
      theme: 'light',
    });
  } finally {
    (await other.indexed).close();
  }
});
