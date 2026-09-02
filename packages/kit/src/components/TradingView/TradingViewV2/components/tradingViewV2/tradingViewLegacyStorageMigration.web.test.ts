import { importLegacyTradingViewStorageEntries } from './tradingViewLegacyStorageMigration.web';

describe('importLegacyTradingViewStorageEntries', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('imports supported legacy chart storage without overwriting current data', () => {
    localStorage.setItem('tradingview_settings_market_theme', 'current');

    importLegacyTradingViewStorageEntries([
      ['tradingview_drawings_token_BTC', '{"drawing":true}'],
      ['tradingview_settings_market_theme', 'legacy'],
      ['tradingview_study_template_market', '{"studies":[]}'],
    ]);

    expect(localStorage.getItem('tradingview_drawings_token_BTC')).toBe(
      '{"drawing":true}',
    );
    expect(localStorage.getItem('tradingview_settings_market_theme')).toBe(
      'current',
    );
    expect(localStorage.getItem('tradingview_study_template_market')).toBe(
      '{"studies":[]}',
    );
  });

  test('rejects unrelated host storage keys', () => {
    expect(() =>
      importLegacyTradingViewStorageEntries([
        ['wallet_sensitive_setting', 'value'],
      ]),
    ).toThrow('TradingView storage migration entry is invalid');
    expect(localStorage.getItem('wallet_sensitive_setting')).toBeNull();
  });
});
