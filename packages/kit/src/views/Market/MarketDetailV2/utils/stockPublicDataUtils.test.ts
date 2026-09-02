import type { IMarketStockAnalystRatings } from '@onekeyhq/shared/types/marketV2';

import {
  STOCK_ABOUT_IPO_DATE_LABEL,
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

  it('labels ipoDate as IPO Date instead of Founded', () => {
    expect(STOCK_ABOUT_IPO_DATE_LABEL).toBe('IPO Date');
    expect(STOCK_ABOUT_IPO_DATE_LABEL).not.toBe('Founded');
  });
});
