import { EJotaiContextStoreNames } from './jotaiContextStoreMap';

describe('jotaiContextStoreMap', () => {
  it('includes the market swap review store name', () => {
    expect(EJotaiContextStoreNames.marketSwapReview).toBe('marketSwapReview');
    expect(EJotaiContextStoreNames.marketSwap).toBe('marketSwap');
  });
});
