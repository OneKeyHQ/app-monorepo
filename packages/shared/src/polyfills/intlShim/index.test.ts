/* eslint-disable @typescript-eslint/no-require-imports */

const mockInstallOrder: string[] = [];

jest.mock('@formatjs/intl-getcanonicallocales/should-polyfill', () => ({
  shouldPolyfill: () => true,
}));
jest.mock('@formatjs/intl-locale/should-polyfill', () => ({
  shouldPolyfill: () => true,
}));
jest.mock('@formatjs/intl-pluralrules/should-polyfill', () => ({
  shouldPolyfill: () => true,
}));

jest.mock('@formatjs/intl-getcanonicallocales/polyfill', () => {
  mockInstallOrder.push('getCanonicalLocales');
  return {};
});
jest.mock('@formatjs/intl-locale/polyfill', () => {
  mockInstallOrder.push('Locale');
  return {};
});
jest.mock('@formatjs/intl-pluralrules/polyfill', () => {
  mockInstallOrder.push('PluralRules');
  return {};
});
jest.mock('@formatjs/intl-pluralrules/locale-data/en', () => {
  mockInstallOrder.push('PluralRules.locale.en');
  return {};
});

describe('intlShim', () => {
  beforeEach(() => {
    jest.resetModules();
    mockInstallOrder.length = 0;
  });

  it('installs every required Intl polyfill before require returns', () => {
    jest.isolateModules(() => {
      require('./index');

      expect(mockInstallOrder).toEqual([
        'getCanonicalLocales',
        'Locale',
        'PluralRules',
        'PluralRules.locale.en',
      ]);
    });
  });
});
