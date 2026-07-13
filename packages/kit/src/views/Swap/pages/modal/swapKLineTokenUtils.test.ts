import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapKLineToken,
  getDefaultSwapKLineSide,
  haveSameSwapKLineTokenSymbol,
} from './swapKLineTokenUtils';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

const buildToken = (symbol: string) => ({ symbol }) as ISwapKLineToken;

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
});
