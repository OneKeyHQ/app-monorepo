import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  formatChartTypeOptionLabel,
  getChartTypeIconName,
} from './NativeChartControlsShared';

import type { IntlShape, MessageDescriptor } from 'react-intl';

const intl = {
  formatMessage: ({ id }: MessageDescriptor) => {
    if (id === ETranslations.market_candle) {
      return 'Candles';
    }
    if (id === ETranslations.market_heikin_ashi) {
      return 'HEIKIN_ASHI_I18N';
    }
    if (id === ETranslations.market_bars) {
      return 'BARS_I18N';
    }
    if (id === ETranslations.market_line) {
      return 'Line';
    }
    if (id === ETranslations.market_area) {
      return 'AREA_I18N';
    }
    return id ?? '';
  },
} as IntlShape;

describe('NativeChartControlsShared', () => {
  it('formats all supported chart type labels', () => {
    expect(
      formatChartTypeOptionLabel(intl, { label: 'Candle', value: 1 }),
    ).toBe('Candles');
    expect(formatChartTypeOptionLabel(intl, { label: 'Line', value: 2 })).toBe(
      'Line',
    );
    expect(
      formatChartTypeOptionLabel(intl, { label: 'Heikin Ashi', value: 8 }),
    ).toBe('HEIKIN_ASHI_I18N');
    expect(formatChartTypeOptionLabel(intl, { label: 'Bars', value: 0 })).toBe(
      'BARS_I18N',
    );
    expect(formatChartTypeOptionLabel(intl, { label: 'Area', value: 3 })).toBe(
      'AREA_I18N',
    );
    expect(
      formatChartTypeOptionLabel(intl, { label: 'Baseline', value: 10 }),
    ).toBe('Baseline');
  });

  it('uses distinct icons for supported chart type labels', () => {
    expect(getChartTypeIconName({ label: 'Candles', value: 1 })).toBe(
      'TradingViewCandlesOutline',
    );
    expect(getChartTypeIconName({ label: 'Heikin Ashi', value: 8 })).toBe(
      'TradingViewBarsOutline',
    );
    expect(getChartTypeIconName({ label: 'Bars', value: 0 })).toBe(
      'TradingViewCandlesHlcOutline',
    );
    expect(getChartTypeIconName({ label: 'Line', value: 2 })).toBe(
      'TradingViewLineOutline',
    );
    expect(getChartTypeIconName({ label: 'Area', value: 3 })).toBe(
      'ChartTrending2Outline',
    );
  });
});
