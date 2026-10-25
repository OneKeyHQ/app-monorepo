import { buildCoinScopedOrderOpenParams } from '@onekeyhq/kit-bg/src/services/ServiceHyperLiquid/utils/coinScopedOrder';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  buildReversePositionOrder,
  isReversePositionScopeValid,
} from './reversePosition';

const snapshot = {
  coin: 'xyz:NVDA',
  accountAddress: '0xAbCd',
  positionSize: '1.2345',
};

describe('reverse position', () => {
  it.each(['1.2345', '-1.2345'])(
    'submits one exact opposite market order for %s without TP/SL',
    (positionSize) => {
      const result = buildReversePositionOrder({
        snapshot: { ...snapshot, positionSize },
        price: '100',
        maxSize: '5',
        szDecimals: 4,
      });
      expect(result.error).toBeUndefined();
      expect(result.params).toEqual({
        coin: snapshot.coin,
        expectedAccountAddress: snapshot.accountAddress,
        isBuy: positionSize.startsWith('-'),
        size: '2.469',
        price: '100',
        orderType: 'market',
        slippage: 0.08,
      });
      if (!result.params) throw new OneKeyLocalError('Expected reverse order');
      expect(
        buildCoinScopedOrderOpenParams({
          params: result.params,
          assetId: 110_000,
        }),
      ).toMatchObject({
        assetId: 110_000,
        reduceOnly: false,
        type: 'market',
        tpTriggerPx: undefined,
        slTriggerPx: undefined,
      });
    },
  );

  it.each([
    {
      positionSize: '0',
      price: '100',
      maxSize: '5',
      szDecimals: 4,
      error: 'invalidSize',
    },
    {
      positionSize: 'NaN',
      price: '100',
      maxSize: '5',
      szDecimals: 4,
      error: 'invalidSize',
    },
    {
      positionSize: '1.23456',
      price: '100',
      maxSize: '5',
      szDecimals: 4,
      error: 'invalidSize',
    },
    {
      positionSize: '1',
      price: '0',
      maxSize: '5',
      szDecimals: 4,
      error: 'invalidPrice',
    },
    {
      positionSize: '1',
      price: '100',
      maxSize: '1.9',
      szDecimals: 4,
      error: 'insufficientMargin',
    },
    {
      positionSize: '0.01',
      price: '100',
      maxSize: '5',
      szDecimals: 4,
      error: 'minimumOrder',
    },
  ])(
    'rejects invalid orders: $error',
    ({ positionSize, price, maxSize, szDecimals, error }) => {
      expect(
        buildReversePositionOrder({
          snapshot: { ...snapshot, positionSize },
          price,
          maxSize,
          szDecimals,
        }),
      ).toEqual({ error });
    },
  );

  it('accepts normalized account and numerically equal position size', () => {
    expect(
      isReversePositionScopeValid({
        snapshot,
        accountAddress: '0xabcd',
        position: { coin: snapshot.coin, szi: '1.234500' },
      }),
    ).toBe(true);
  });

  it.each([
    {
      accountAddress: '0xother',
      position: { coin: snapshot.coin, szi: snapshot.positionSize },
    },
    { accountAddress: snapshot.accountAddress, position: undefined },
    {
      accountAddress: snapshot.accountAddress,
      position: { coin: 'BTC', szi: snapshot.positionSize },
    },
    {
      accountAddress: snapshot.accountAddress,
      position: { coin: snapshot.coin, szi: '-1.2345' },
    },
    {
      accountAddress: snapshot.accountAddress,
      position: { coin: snapshot.coin, szi: '1.2346' },
    },
    {
      accountAddress: snapshot.accountAddress,
      position: { coin: snapshot.coin, szi: '0' },
    },
  ])('rejects changed account or position', (current) => {
    expect(isReversePositionScopeValid({ snapshot, ...current })).toBe(false);
  });
});
