jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));

describe('Perps mode on client initialization', () => {
  it.each([
    {
      name: 'fresh or reset client',
      installed: false,
      settings: undefined,
      expected: 'simple',
    },
    {
      name: 'upgrade without Perps settings',
      installed: true,
      settings: undefined,
      expected: 'pro',
    },
    {
      name: 'upgrade without a mode preference',
      installed: true,
      settings: { showTradeMarks: false },
      expected: 'pro',
    },
    {
      name: 'saved Easy preference',
      installed: true,
      settings: { mobileTradingMode: 'simple' },
      expected: 'simple',
    },
    {
      name: 'saved Pro preference',
      installed: true,
      settings: { mobileTradingMode: 'pro' },
      expected: 'pro',
    },
  ])('$name uses $expected', async ({ installed, settings, expected }) => {
    jest.resetModules();
    const { onekeyJotaiStorage, buildJotaiStorageKey } =
      await import('./jotaiStorage');
    const { EAtomNames } = await import('./atomNames');
    const perpsKey = buildJotaiStorageKey(EAtomNames.perpsCustomSettingsAtom);
    const storage = new Map<string, unknown>();
    if (installed) {
      storage.set(buildJotaiStorageKey(EAtomNames.settingsPersistAtom), {
        instanceId: 'existing-client',
      });
    }
    if (settings) {
      storage.set(perpsKey, settings);
    }
    if ('getAllEntries' in onekeyJotaiStorage) {
      jest
        .spyOn(onekeyJotaiStorage, 'getAllEntries')
        .mockImplementation(async () => new Map(storage));
      jest
        .spyOn(onekeyJotaiStorage, 'getItem')
        .mockImplementation(
          async (key, initialValue: unknown) =>
            storage.get(key) ?? initialValue,
        );
      jest
        .spyOn(onekeyJotaiStorage, 'setItem')
        .mockImplementation(async (key, value) => {
          storage.set(key, value);
        });
    }

    const { jotaiInit } = await import('./jotaiInit');
    const atoms = await jotaiInit();
    await expect(atoms.perpsCustomSettingsAtom.get()).resolves.toEqual(
      expect.objectContaining({ ...settings, mobileTradingMode: expected }),
    );
    expect(storage.get(perpsKey)).toEqual(
      expect.objectContaining({ mobileTradingMode: expected }),
    );
  });
});

describe('restored client preferences', () => {
  it('does not seed Easy mode when identity was restored from backup', async () => {
    const { initializePreferences } = await import('./initializePreferences');
    const { onekeyJotaiStorage } = await import('./jotaiStorage');
    const write = jest.spyOn(onekeyJotaiStorage, 'setItem');
    write.mockClear();
    const storage = new Map<string, unknown>();
    await initializePreferences(storage, true);
    expect(write).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });
});
