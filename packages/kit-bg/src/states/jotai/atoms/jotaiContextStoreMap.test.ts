import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';

import { EJotaiContextStoreNames } from './jotaiContextStoreMap';

describe('jotaiContextStoreMap', () => {
  it('includes the market swap review store name', () => {
    expect(EJotaiContextStoreNames.marketSwapReview).toBe('marketSwapReview');
  });

  it('creates an isolated store for market swap review', () => {
    const marketStore = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.marketSwapReview,
    });
    const swapStore = jotaiContextStore.getOrCreateStore({
      storeName: EJotaiContextStoreNames.swap,
    });

    expect(marketStore).not.toBe(swapStore);
    expect(
      jotaiContextStore.getOrCreateStore({
        storeName: EJotaiContextStoreNames.marketSwapReview,
      }),
    ).toBe(marketStore);

    jotaiContextStore.removeStore({
      storeName: EJotaiContextStoreNames.marketSwapReview,
    });
    jotaiContextStore.removeStore({
      storeName: EJotaiContextStoreNames.swap,
    });
  });
});
