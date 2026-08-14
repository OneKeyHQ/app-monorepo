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
      return 'Heikin Ashi';
    }
    if (id === ETranslations.market_bars) {
      return 'Bars';
    }
    if (id === ETranslations.market_line) {
      return 'Line';
    }
    if (id === ETranslations.market_area) {
      return 'Area';
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
    ).toBe('Heikin Ashi');
    expect(formatChartTypeOptionLabel(intl, { label: 'Bars', value: 0 })).toBe(
      'Bars',
    );
    expect(formatChartTypeOptionLabel(intl, { label: 'Area', value: 3 })).toBe(
      'Area',
    );
    expect(
      formatChartTypeOptionLabel(intl, { label: 'Candles HLC', value: 21 }),
    ).toBe('Candles HLC');
  });

  it('uses distinct icons for supported chart type labels', () => {
    expect(getChartTypeIconName({ label: 'Candles', value: 1 })).toBe(
      'TradingViewCandlesOutline',
    );
    expect(getChartTypeIconName({ label: 'Heikin Ashi', value: 8 })).toBe(
      'TradingViewCandlesOutline',
    );
    expect(getChartTypeIconName({ label: 'Bars', value: 0 })).toBe(
      'TradingViewCandlesHlcOutline',
    );
    expect(getChartTypeIconName({ label: 'Candles HLC', value: 21 })).toBe(
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
