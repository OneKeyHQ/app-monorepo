import { resolveTradingSize } from '@onekeyhq/shared/src/utils/perpsUtils';
import { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';
import type { IActiveAssetData } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildAddPositionMinimumAmountLabel,
  computeAddPositionMaxSize,
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
    ).toBe('$10.00');
    expect(
      buildAddPositionMinimumAmountLabel({ ...base, sizeInputUnit: 'token' }),
    ).toBe('0.10 ETH');
    expect(
      buildAddPositionMinimumAmountLabel({ ...base, sizeInputUnit: 'margin' }),
    ).toBe('$2.00');
    expect(
      buildAddPositionMinimumAmountLabel({
        ...base,
        price: '3.39',
        szDecimals: 1,
        sizeInputUnit: 'usd',
      }),
    ).toBe('$10.17');
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

// Regression values from OK-58629: ETH long 2x, mark 1881.29, limit 22,
// and the cost slider at 50%.
describe('computeAddPositionMaxSize', () => {
  const MARK_PRICE = '1881.29';
  const SZ_DECIMALS = 4;
  const MAX_TRADE_SZS = ['0.334', '0.334'];
  const base = {
    markPrice: MARK_PRICE,
    maxTradeSzs: MAX_TRADE_SZS,
    leverage: 2,
    szDecimals: SZ_DECIMALS,
  };

  it('re-denominates a passive buy limit at the typed price', () => {
    expect(
      computeAddPositionMaxSize({
        ...base,
        isBuy: true,
        orderType: 'limit',
        limitPrice: '22',
      }),
    ).toBe('28.5614');
  });

  it('clears the bogus margin and minimum-order errors from the report', () => {
    const cap = computeAddPositionMaxSize({
      ...base,
      isBuy: true,
      orderType: 'limit',
      limitPrice: '22',
    });
    const size = resolveTradingSize({
      sizeInputMode: EPerpsSizeInputMode.SLIDER,
      sizePercent: 50,
      side: 'long',
      maxSize: cap,
      szDecimals: SZ_DECIMALS,
    });

    expect(size).toBe('14.2807');
    expect(
      validateAddPositionOrder({
        size,
        price: '22',
        maxSize: cap,
        szDecimals: SZ_DECIMALS,
      }).error,
    ).toBeUndefined();

    const rawSize = resolveTradingSize({
      sizeInputMode: EPerpsSizeInputMode.SLIDER,
      sizePercent: 50,
      side: 'long',
      maxSize: MAX_TRADE_SZS[0],
      szDecimals: SZ_DECIMALS,
    });
    expect(
      validateAddPositionOrder({
        size: rawSize,
        price: '22',
        maxSize: MAX_TRADE_SZS[0],
        szDecimals: SZ_DECIMALS,
      }).error,
    ).toBe('minimumOrder');
  });

  it('keeps market orders denominated at the mark price', () => {
    expect(
      computeAddPositionMaxSize({
        ...base,
        isBuy: true,
        orderType: 'market',
        limitPrice: '22',
      }),
    ).toBe('0.334');
  });

  it('does not inflate a marketable sell limit below the mark', () => {
    expect(
      computeAddPositionMaxSize({
        isBuy: false,
        orderType: 'limit',
        limitPrice: '95',
        markPrice: '100',
        maxTradeSzs: ['1', '1'],
        leverage: 2,
        szDecimals: 4,
      }),
    ).toBe('1');
  });

  it('shrinks a passive sell limit above the mark', () => {
    expect(
      computeAddPositionMaxSize({
        isBuy: false,
        orderType: 'limit',
        limitPrice: '200',
        markPrice: '100',
        maxTradeSzs: ['1', '1'],
        leverage: 2,
        szDecimals: 4,
      }),
    ).toBe('0.5');
  });

  it('falls back to zero while the mark price is unavailable', () => {
    expect(
      computeAddPositionMaxSize({
        ...base,
        markPrice: undefined,
        isBuy: true,
        orderType: 'limit',
        limitPrice: '22',
      }),
    ).toBe('0');
  });

  it('pins the reported $5.01 minimum label', () => {
    expect(
      buildAddPositionMinimumAmountLabel({
        price: '22',
        szDecimals: SZ_DECIMALS,
        leverage: 2,
        symbol: 'ETH',
        sizeInputUnit: 'margin',
      }),
    ).toBe('$5.01');
  });
});
