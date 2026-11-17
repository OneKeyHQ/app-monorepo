import { getMarketTopCoinsRequestType } from './marketTopCoinsCategoryUtils';

describe('getMarketTopCoinsRequestType', () => {
  it.each([undefined, '', 'all'])(
    'keeps the unfiltered Top coins request for %p',
    (categoryId) => {
      expect(getMarketTopCoinsRequestType(categoryId)).toBe('top_coins');
    },
  );

  it('requests a sub-category through its own type', () => {
    expect(getMarketTopCoinsRequestType('market_l1_l2_chains')).toBe(
      'market_l1_l2_chains',
    );
  });
});
