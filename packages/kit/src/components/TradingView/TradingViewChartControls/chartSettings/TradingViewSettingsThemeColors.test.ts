import { flattenTradingViewSettingsThemeColor } from './TradingViewSettingsThemeColors';

describe('TradingView settings theme colors', () => {
  it('flattens semantic alpha colors against the chart background', () => {
    expect(flattenTradingViewSettingsThemeColor('#008f4acf', '#ffffff')).toBe(
      '#30a46c',
    );
    expect(flattenTradingViewSettingsThemeColor('#db0007b7', '#ffffff')).toBe(
      '#e5484d',
    );
  });

  it('uses the active dark background when flattening dark theme colors', () => {
    expect(flattenTradingViewSettingsThemeColor('#44ffa49e', '#0f0f0f')).toBe(
      '#30a46b',
    );
    expect(flattenTradingViewSettingsThemeColor('#fe4e54e4', '#0f0f0f')).toBe(
      '#e5474d',
    );
  });

  it('preserves opaque and unsupported color values', () => {
    expect(flattenTradingViewSettingsThemeColor('#ABCDEF', '#ffffff')).toBe(
      '#ABCDEF',
    );
    expect(flattenTradingViewSettingsThemeColor('$green9', '#ffffff')).toBe(
      '$green9',
    );
  });
});
