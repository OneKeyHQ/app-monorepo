import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import { calculateRequiredSubscriptions } from './SubscriptionConfig';

describe('calculateRequiredSubscriptions', () => {
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
