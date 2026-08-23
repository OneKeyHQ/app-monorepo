const { resolveElectronLanguages } = require('./resolve-electron-languages');

describe('resolveElectronLanguages', () => {
  test('uses exact Electron locales and falls back to the base language', () => {
    expect(
      resolveElectronLanguages(['en_US', 'es', 'fr_FR'], ['en', 'es', 'fr']),
    ).toEqual(['en', 'es', 'fr']);
  });

  test('deduplicates OneKey locales that share Electron resources', () => {
    expect(
      resolveElectronLanguages(
        ['pt', 'pt_BR', 'zh_CN', 'zh_HK', 'zh_TW'],
        ['pt_BR', 'pt_PT', 'zh_CN', 'zh_TW'],
      ),
    ).toEqual(['pt_BR', 'pt_PT', 'zh_CN', 'zh_TW']);
  });

  test('automatically includes newly supported Electron locales', () => {
    expect(resolveElectronLanguages(['en_US', 'ar'], ['en', 'ar'])).toEqual([
      'ar',
      'en',
    ]);
  });

  test('preserves Windows and Linux Electron locale names', () => {
    expect(
      resolveElectronLanguages(
        ['en_US', 'fr_FR', 'pt', 'pt_BR', 'zh_CN', 'zh_HK'],
        ['en-US', 'fr', 'pt-BR', 'pt-PT', 'zh-CN', 'zh-TW'],
      ),
    ).toEqual(['en-US', 'fr', 'pt-BR', 'pt-PT', 'zh-CN', 'zh-TW']);
  });

  test('falls back to the platform English locale when unsupported', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

    expect(resolveElectronLanguages(['tl'], ['en-US', 'fil'])).toEqual([
      'en-US',
    ]);
    expect(consoleWarn).toHaveBeenCalledWith(
      '[electron-languages] no Electron locale for OneKey locale "tl", falling back to "en-US"',
    );

    consoleWarn.mockRestore();
  });
});
