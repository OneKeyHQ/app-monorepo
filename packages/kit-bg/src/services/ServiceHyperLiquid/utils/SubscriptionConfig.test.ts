import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import { calculateRequiredSubscriptions } from './SubscriptionConfig';

describe('calculateRequiredSubscriptions', () => {
  it('subscribes openOrders to the main dex response channel', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: '0x0000000000000000000000000000000000000001',
      currentSymbol: 'ETH',
      isConnected: true,
    });

    const openOrdersSpec = specs.find(
      (spec) => spec.type === ESubscriptionType.OPEN_ORDERS,
    );

    expect(openOrdersSpec?.params).toMatchObject({
      user: '0x0000000000000000000000000000000000000001',
      dex: '',
    });
  });
});
