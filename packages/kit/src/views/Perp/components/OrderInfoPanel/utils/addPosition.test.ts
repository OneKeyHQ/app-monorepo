import type { IActiveAssetData } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildAddPositionMinimumAmountLabel,
  getPositionDirection,
  isAddPositionAssetDataScoped,
  isAddPositionScopeValid,
  validateAddPositionOrder,
} from './addPosition';

describe('add position guards', () => {
  const accountAddress = '0x1111111111111111111111111111111111111111';

  it.each([
    ['1', 'long'],
    ['-1', 'short'],
    ['0', null],
    ['bad', null],
  ] as const)('maps position size %s to %s', (szi, expected) => {
    expect(getPositionDirection(szi)).toBe(expected);
  });

  it('requires the original account, coin, and direction to remain current', () => {
    const base = {
      expectedAccountAddress: accountAddress,
      currentAccountAddress: accountAddress.toUpperCase(),
      coin: 'xyz:NVDA',
      isBuy: true,
      currentPosition: { coin: 'xyz:NVDA', szi: '2' },
    };
    expect(isAddPositionScopeValid(base)).toBe(true);
    expect(
      isAddPositionScopeValid({
        ...base,
        currentAccountAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe(false);
    expect(
      isAddPositionScopeValid({
        ...base,
        currentPosition: { coin: 'BTC', szi: '2' },
      }),
    ).toBe(false);
    expect(
      isAddPositionScopeValid({
        ...base,
        currentPosition: { coin: 'xyz:NVDA', szi: '-2' },
      }),
    ).toBe(false);
  });

  it('rejects active-asset data from another account or coin', () => {
    const data = {
      user: accountAddress,
      coin: 'ETH',
      leverage: { type: 'cross', value: 5 },
      maxTradeSzs: ['1', '1'],
      availableToTrade: ['100', '100'],
      markPx: '3000',
    } as IActiveAssetData;
    expect(
      isAddPositionAssetDataScoped({ data, coin: 'ETH', accountAddress }),
    ).toBe(true);
    expect(
      isAddPositionAssetDataScoped({ data, coin: 'BTC', accountAddress }),
    ).toBe(false);
    expect(
      isAddPositionAssetDataScoped({
        data,
        coin: 'ETH',
        accountAddress: '0x2222222222222222222222222222222222222222',
      }),
    ).toBe(false);
  });

  it('formats with target precision and enforces balance plus $10 minimum', () => {
    expect(
      validateAddPositionOrder({
        size: '1.23459',
        price: '100',
        maxSize: '2',
        szDecimals: 4,
      }),
    ).toEqual({ size: '1.2345' });
    expect(
      validateAddPositionOrder({
        size: '2.1',
        price: '100',
        maxSize: '2',
        szDecimals: 2,
      }).error,
    ).toBe('insufficientMargin');
    expect(
      validateAddPositionOrder({
        size: '0.09',
        price: '100',
        maxSize: '2',
        szDecimals: 2,
      }).error,
    ).toBe('minimumOrder');
  });

  it('expresses the minimum order hint in the active size unit', () => {
    const base = {
      price: '100',
      szDecimals: 2,
      leverage: 5,
      symbol: 'ETH',
    };
    expect(
      buildAddPositionMinimumAmountLabel({ ...base, sizeInputUnit: 'usd' }),
    ).toBe('$10');
    expect(
      buildAddPositionMinimumAmountLabel({ ...base, sizeInputUnit: 'token' }),
    ).toBe('0.10 ETH');
    expect(
      buildAddPositionMinimumAmountLabel({ ...base, sizeInputUnit: 'margin' }),
    ).toBe('$2.00');
  });

  it('falls back to the usd minimum when price or leverage is unusable', () => {
    expect(
      buildAddPositionMinimumAmountLabel({
        price: '0',
        szDecimals: 2,
        leverage: 5,
        symbol: 'ETH',
        sizeInputUnit: 'token',
      }),
    ).toBe('$10');
    expect(
      buildAddPositionMinimumAmountLabel({
        price: '100',
        szDecimals: 2,
        leverage: 0,
        symbol: 'ETH',
        sizeInputUnit: 'margin',
      }),
    ).toBe('$10');
  });
});
