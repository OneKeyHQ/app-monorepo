import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getMarketPriceChangeLabelId } from './MarketSimpleChartRangeChangeContext';

describe('getMarketPriceChangeLabelId', () => {
  const base = { priceMode: 'share', baseline: 1, latest: 1 } as const;

  it('reads sessions and a trading-day 1D as today', () => {
    expect(
      getMarketPriceChangeLabelId(
        { ...base, range: '1D', session: 'regular' },
        'share',
      ),
    ).toBe(ETranslations.date_today);
    expect(
      getMarketPriceChangeLabelId(
        { ...base, range: '1D', isTradingDay: true },
        'share',
      ),
    ).toBe(ETranslations.date_today);
    expect(getMarketPriceChangeLabelId(undefined, 'share')).toBe(
      ETranslations.date_today,
    );
  });

  it('reads the rolling 1D as the past 24 hours', () => {
    expect(getMarketPriceChangeLabelId({ ...base, range: '1D' }, 'share')).toBe(
      ETranslations.market_range_change_past_24h,
    );
  });
});
