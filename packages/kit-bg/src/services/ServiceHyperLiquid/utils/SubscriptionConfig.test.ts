import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import { calculateRequiredSubscriptions } from './SubscriptionConfig';

describe('calculateRequiredSubscriptions', () => {
  it('always subscribes to all dex asset contexts for token selector prices', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: '',
      isConnected: true,
    });

    expect(
      specs.some((spec) => spec.type === ESubscriptionType.ALL_DEXS_ASSET_CTXS),
    ).toBe(true);
  });

  it('subscribes to L2 book when an active market has order book options', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: 'BTC',
      isConnected: true,
      l2BookOptions: {
        nSigFigs: 5,
        mantissa: null,
      },
    });

    expect(
      specs
        .filter((spec) => spec.type === ESubscriptionType.L2_BOOK)
        .map((spec) => spec.params),
    ).toEqual([
      {
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: null,
      },
    ]);
  });

  it('subscribes openOrders to all supported perp dex response channels', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: '0x0000000000000000000000000000000000000001',
      currentSymbol: 'ETH',
      isConnected: true,
    });

    const openOrdersSpecs = specs.filter(
      (spec) => spec.type === ESubscriptionType.OPEN_ORDERS,
    );

    expect(openOrdersSpecs.map((spec) => spec.params)).toEqual(
      expect.arrayContaining([
        {
          user: '0x0000000000000000000000000000000000000001',
          dex: '',
        },
        {
          user: '0x0000000000000000000000000000000000000001',
          dex: 'xyz',
        },
      ]),
    );
  });
});
