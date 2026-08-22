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

  test('fails when Electron has no resources for a OneKey locale', () => {
    expect(() => resolveElectronLanguages(['tl'], ['en', 'fil'])).toThrow(
      'No Electron locale is available for OneKey locale "tl"',
    );
  });
});
