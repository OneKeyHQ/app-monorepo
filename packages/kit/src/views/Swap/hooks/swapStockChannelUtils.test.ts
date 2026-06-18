import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  filterStockPayTokenCandidates,
  resolveStockChannelToken,
} from './swapStockChannelUtils';

const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const usdtToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
};

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
};

describe('swapStockChannelUtils', () => {
  it('does not resolve an ordinary swap pair token as the stock token', () => {
    expect(
      resolveStockChannelToken({
        stockTokenState: undefined,
        marketStockToken: undefined,
      }),
    ).toBeUndefined();
  });

  it('prefers stock-owned state before market detail stock token', () => {
    expect(
      resolveStockChannelToken({
        stockTokenState: appleStockToken,
        marketStockToken: ethToken,
      }),
    ).toBe(appleStockToken);
  });

  it('falls back to the active market stock token', () => {
    expect(
      resolveStockChannelToken({
        stockTokenState: undefined,
        marketStockToken: appleStockToken,
      }),
    ).toBe(appleStockToken);
  });

  it('filters stock pay token candidates to USDC and USDT only', () => {
    expect(
      filterStockPayTokenCandidates([ethToken, usdcToken, usdtToken]).map(
        (token) => token.symbol,
      ),
    ).toEqual(['USDC', 'USDT']);
  });

  it('fails closed when the speed config has no USDC or USDT pay token', () => {
    expect(filterStockPayTokenCandidates([ethToken])).toEqual([]);
  });
});
