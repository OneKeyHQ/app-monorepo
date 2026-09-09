import { ETranslations } from '@onekeyhq/shared/src/locale';
import enUS from '@onekeyhq/shared/src/locale/json/en_US.json';
import type { IMarketStockAnalystRatings } from '@onekeyhq/shared/types/marketV2';

import {
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
});
