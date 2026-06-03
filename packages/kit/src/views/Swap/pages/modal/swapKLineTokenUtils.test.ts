import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapKLineStableToken,
  type ISwapKLineToken,
  getDefaultSwapKLineSide,
  isSwapKLineStableToken,
} from './swapKLineTokenUtils';

function buildSwapKLineToken(
  overrides: Partial<ISwapKLineToken>,
): ISwapKLineToken {
  return {
    networkId: 'evm--1',
    contractAddress: '',
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
    ...overrides,
  };
}

describe('swapKLineTokenUtils', () => {
  const stableTokens: ISwapKLineStableToken[] = [
    {
      networkId: 'evm--1',
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
  ];
  const usdtToken = buildSwapKLineToken({
    contractAddress: '0xDAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    decimals: 6,
    isNative: false,
  });
  const pepeToken = buildSwapKLineToken({
    contractAddress: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
    symbol: 'PEPE',
    isNative: false,
  });

  it('matches stable tokens from the server-maintained token list by token identity', () => {
    expect(
      isSwapKLineStableToken({
        token: usdtToken,
        stableTokens,
      }),
    ).toBe(true);
    expect(
      isSwapKLineStableToken({
        token: pepeToken,
        stableTokens,
      }),
    ).toBe(false);
  });

  it('defaults to the non-stable token when only one side is stable', () => {
    expect(
      getDefaultSwapKLineSide({
        fromToken: pepeToken,
        stableTokens,
        toToken: usdtToken,
      }),
    ).toBe(ESwapDirectionType.FROM);
    expect(
      getDefaultSwapKLineSide({
        fromToken: usdtToken,
        stableTokens,
        toToken: pepeToken,
      }),
    ).toBe(ESwapDirectionType.TO);
  });
});
