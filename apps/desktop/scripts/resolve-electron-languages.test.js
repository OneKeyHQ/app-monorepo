const {
  getElectronLanguages,
  resolveElectronLanguages,
} = require('./resolve-electron-languages');

describe('resolveElectronLanguages', () => {
  test('includes exact and base locale candidates for every target', () => {
    expect(resolveElectronLanguages(['en_US', 'es', 'fr_FR'])).toEqual([
      'en',
      'en-US',
      'en_US',
      'es',
      'fr',
      'fr-FR',
      'fr_FR',
    ]);
  });

  test('includes Portuguese and Chinese regional fallbacks', () => {
    const languages = resolveElectronLanguages([
      'pt',
      'pt_BR',
      'zh_CN',
      'zh_HK',
      'zh_TW',
    ]);

    expect(languages).toEqual(
      expect.arrayContaining([
        'pt-BR',
        'pt-PT',
        'pt_BR',
        'pt_PT',
        'zh-CN',
        'zh-TW',
        'zh_CN',
        'zh_TW',
      ]),
    );
    expect(new Set(languages).size).toBe(languages.length);
  });

  test('automatically includes newly added OneKey locales', () => {
    expect(resolveElectronLanguages(['en_US', 'ar'])).toEqual([
      'ar',
      'en',
      'en-US',
      'en_US',
    ]);
  });

  test('keeps target resources when macOS builds macOS and Linux together', () => {
    const languages = resolveElectronLanguages([
      'en_US',
      'fr_FR',
      'pt',
      'pt_BR',
      'zh_CN',
      'zh_HK',
    ]);
    const macElectronLocales = ['en', 'fr', 'pt_BR', 'pt_PT', 'zh_CN', 'zh_TW'];
    const linuxElectronLocales = [
      'en-US',
      'fr',
      'pt-BR',
      'pt-PT',
      'zh-CN',
      'zh-TW',
    ];

    expect(
      macElectronLocales.filter((locale) => languages.includes(locale)),
    ).toEqual(macElectronLocales);
    expect(
      linuxElectronLocales.filter((locale) => languages.includes(locale)),
    ).toEqual(linuxElectronLocales);
  });

  test('always keeps each platform English fallback locale', () => {
    expect(resolveElectronLanguages(['tl'])).toEqual(['en', 'en-US', 'tl']);
  });

  test('derives the allowlist from the current OneKey locale catalog', () => {
    expect(getElectronLanguages()).toEqual(
      expect.arrayContaining([
        'en',
        'en-US',
        'pt-BR',
        'pt_BR',
        'zh-CN',
        'zh_CN',
      ]),
    );
  });
});
