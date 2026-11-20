import 'fake-indexeddb/auto';

import WebStorage, { EWebStorageKeyPrefix } from './WebStorage';

let fixture = 0;

function openSettingsPair() {
  fixture += 1;
  const options = {
    dbName: `fixture-app-settings-${fixture}`,
    bucketName: 'fixture-story',
    tableName: 'keyvaluepairs',
    legacyKeyPrefix: EWebStorageKeyPrefix.GlobalStates,
  };
  return [new WebStorage(options), new WebStorage(options)] as const;
}

const settingsKey = 'fixture-settings-key';

test('atomic settings patches preserve unrelated writes through separate connections', async () => {
  const [first, second] = openSettingsPair();
  try {
    await first.setItem(
      settingsKey,
      JSON.stringify({
        locale: 'system',
        theme: 'light',
        preserve: { other: 'setting' },
      }),
      undefined,
    );
    await Promise.all([
      first.patchObjectItem(settingsKey, { locale: 'ja-JP' }),
      second.patchObjectItem(settingsKey, { theme: 'dark' }),
    ]);
    await expect(first.getItem(settingsKey, undefined)).resolves.toBe(
      JSON.stringify({
        locale: 'ja-JP',
        theme: 'dark',
        preserve: { other: 'setting' },
      }),
    );
  } finally {
    (await first.indexed).close();
    (await second.indexed).close();
  }
});

test('missing settings store only the chosen locale, not generated App settings', async () => {
  const [storage] = openSettingsPair();
  try {
    await storage.patchObjectItem(settingsKey, { locale: 'system' });
    await expect(storage.getItem(settingsKey, undefined)).resolves.toEqual({
      locale: 'system',
    });
  } finally {
    (await storage.indexed).close();
  }
});

test('a malformed settings record is preserved, not replaced', async () => {
  const [storage] = openSettingsPair();
  try {
    await storage.setItem(settingsKey, '{malformed', undefined);
    await expect(
      storage.patchObjectItem(settingsKey, { locale: 'en' }),
    ).rejects.toThrow();
    await expect(storage.getItem(settingsKey, undefined)).resolves.toBe(
      '{malformed',
    );
  } finally {
    (await storage.indexed).close();
  }
});

test.each([true, false])(
  'an ordinary replacement and picker write preserve both settings (locale first=%s)',
  async (localeFirst) => {
    const [picker, wallet] = openSettingsPair();
    try {
      await picker.setItem(
        settingsKey,
        JSON.stringify({ locale: 'en-US', theme: 'light', remove: true }),
        undefined,
      );
      const language = () =>
        picker.patchObjectItem(settingsKey, { locale: 'ja-JP' });
      const theme = () =>
        wallet.patchObjectItem(
          settingsKey,
          { locale: 'en-US', theme: 'dark' },
          { preserveOnReplace: ['locale'] },
        );
      await Promise.all(
        localeFirst ? [language(), theme()] : [theme(), language()],
      );
      await expect(wallet.getItem(settingsKey, undefined)).resolves.toBe(
        JSON.stringify({ locale: 'ja-JP', theme: 'dark' }),
      );
    } finally {
      (await picker.indexed).close();
      (await wallet.indexed).close();
    }
  },
);
