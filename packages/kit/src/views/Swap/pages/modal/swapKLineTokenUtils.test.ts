import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapKLineToken,
  getDefaultSwapKLineSide,
  getResolvableDefaultSwapKLineSide,
  haveSameSwapKLineTokenSymbol,
} from './swapKLineTokenUtils';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

const buildToken = (symbol: string, overrides: Partial<ISwapKLineToken> = {}) =>
  ({ symbol, ...overrides }) as ISwapKLineToken;

describe('swapKLineTokenUtils', () => {
  describe('haveSameSwapKLineTokenSymbol', () => {
    it('matches token symbols without case or surrounding whitespace', () => {
      expect(
        haveSameSwapKLineTokenSymbol({
          fromToken: { symbol: ' ETH ' },
          toToken: { symbol: 'eth' },
        }),
      ).toBe(true);
    });

    it('does not match missing or different symbols', () => {
      expect(
        haveSameSwapKLineTokenSymbol({
          fromToken: { symbol: 'ETH' },
          toToken: { symbol: 'WETH' },
        }),
      ).toBe(false);
      expect(
        haveSameSwapKLineTokenSymbol({
          fromToken: { symbol: 'ETH' },
        }),
      ).toBe(false);
    });
  });

  it('selects the to token when both token symbols are the same', () => {
    expect(
      getDefaultSwapKLineSide({
        fromToken: buildToken('ETH'),
        toToken: buildToken('eth'),
      }),
    ).toBe(ESwapDirectionType.TO);
  });

  it.each([
    {
      expectedSide: ESwapDirectionType.FROM,
      fromToken: buildToken('ETH'),
      toToken: buildToken('eth', { defiMarked: true }),
    },
    {
      expectedSide: ESwapDirectionType.TO,
      fromToken: buildToken('ETH', { defiMarked: true }),
      toToken: buildToken('eth'),
    },
  ])(
    'selects the supported $expectedSide side for same-symbol tokens',
    ({ expectedSide, fromToken, toToken }) => {
      expect(
        getDefaultSwapKLineSide({
          fromToken,
          toToken,
        }),
      ).toBe(expectedSide);
      expect(
        getResolvableDefaultSwapKLineSide({
          fromToken,
          isStableTokenCheckLoading: true,
          toToken,
        }),
      ).toBe(expectedSide);
    },
  );
});
