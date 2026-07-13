import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

import { getPositionUsdState } from './ProtocolUnifiedTableUtils';

function makeAsset(overrides: Partial<IDeFiAsset> = {}): IDeFiAsset {
  return {
    symbol: 'USDC',
    address: '0xasset',
    amount: '1',
    value: 1,
    price: 1,
    category: 'asset',
    meta: {
      decimals: 6,
      isVerified: true,
    },
    ...overrides,
  };
}

describe('ProtocolUnifiedTableUtils', () => {
  it('sums all available asset values', () => {
    expect(
      getPositionUsdState(
        [
          makeAsset({ symbol: 'USDC', value: 10 }),
          makeAsset({ symbol: 'ETH', value: 5 }),
        ],
        [makeAsset({ symbol: 'OP', value: 1 })],
      ),
    ).toEqual({
      value: 16,
      hasAvailableValue: true,
      hasUnavailableValue: false,
    });
  });

  it('keeps available subtotal when only some asset prices are unavailable', () => {
    expect(
      getPositionUsdState([
        makeAsset({ symbol: 'USDC', amount: '10', price: 1, value: 10 }),
        makeAsset({ symbol: 'UNKNOWN', amount: '2', price: 0, value: 0 }),
      ]),
    ).toEqual({
      value: 10,
      hasAvailableValue: true,
      hasUnavailableValue: true,
    });
  });

  it('marks the position unavailable when every non-zero asset is missing price', () => {
    expect(
      getPositionUsdState([
        makeAsset({ symbol: 'UNKNOWN', amount: '2', price: 0, value: 0 }),
        makeAsset({
          symbol: 'UNKNOWN2',
          amount: '3',
          price: Number.NaN,
          value: 0,
        }),
      ]),
    ).toEqual({
      value: 0,
      hasAvailableValue: false,
      hasUnavailableValue: true,
    });
  });

  it('does not treat a zero amount asset as missing price only because value is zero', () => {
    const zeroAmountAsset = makeAsset({
      symbol: 'EMPTY',
      amount: '0',
      price: 0,
      value: 0,
    });

    expect(isProtocolAssetValueUnavailable(zeroAmountAsset)).toBe(false);
    expect(getPositionUsdState([zeroAmountAsset])).toEqual({
      value: 0,
      hasAvailableValue: true,
      hasUnavailableValue: false,
    });
  });

  it('does not treat a rounded zero value as missing price when price exists', () => {
    const dustAsset = makeAsset({
      symbol: 'DUST',
      amount: '0.00000001',
      price: 1,
      value: 0,
    });

    expect(isProtocolAssetValueUnavailable(dustAsset)).toBe(false);
    expect(getPositionUsdState([dustAsset])).toEqual({
      value: 0,
      hasAvailableValue: true,
      hasUnavailableValue: false,
    });
  });
});
