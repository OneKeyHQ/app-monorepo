import { ETranslations } from '@onekeyhq/shared/src/locale';
import enUS from '@onekeyhq/shared/src/locale/json/en_US.json';
import type {
  IMarketStockAnalystRatings,
  IMarketStockPublicDetail,
} from '@onekeyhq/shared/types/marketV2';

import {
  buildStockInfoFromPublicDetail,
  formatDirectPercentValue,
  getStockAnalystConsensus,
} from './stockPublicDataUtils';

describe('stockPublicDataUtils', () => {
  it('displays analyst rating values as direct 0-100 percentages', () => {
    expect(formatDirectPercentValue(73.17)).toBe('73.17%');
    expect(formatDirectPercentValue(19.51)).toBe('19.51%');
    expect(formatDirectPercentValue(7.32)).toBe('7.32%');
    expect(formatDirectPercentValue(0.319_164_422_786_511)).toBe('0.32%');
  });

  it('does not infer a consensus when the backend omits it', () => {
    const ratings: IMarketStockAnalystRatings = {
      buy: 40,
      hold: 20,
      sell: 40,
    };
    expect(getStockAnalystConsensus(ratings)).toBe('--');
  });

  it('labels ipoDate as IPO date instead of Founded', () => {
    const label = (enUS as Record<string, string>)[
      ETranslations.market_stock_about_ipo_date
    ];
    expect(label).toBe('IPO date');
    expect(label).not.toBe('Founded');
  });

  describe('buildStockInfoFromPublicDetail', () => {
    const detail = (tags?: string[]): IMarketStockPublicDetail => ({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      tags,
      categories: [],
      aliases: [],
      marketStatus: { isOpen: true, session: 'OVERNIGHT' },
    });

    it('marks the listing market from tags', () => {
      expect(
        buildStockInfoFromPublicDetail(detail(['US']), { source: 'bstock' })
          .isUSListing,
      ).toBe(true);
      expect(
        buildStockInfoFromPublicDetail(detail(['HK']), { source: 'xstock' })
          .isUSListing,
      ).toBe(false);
    });

    it('leaves the listing unknown without tags', () => {
      expect(
        buildStockInfoFromPublicDetail(detail(), { source: 'bstock' })
          .isUSListing,
      ).toBeUndefined();
    });
  });
});
