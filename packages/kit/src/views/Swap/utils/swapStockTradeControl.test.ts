import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { isQuoteResultForStockTrade } from './swapStockTradeControl';

const nativeToken = {
  networkId: 'evm--1',
  contractAddress: '',
  isNative: true,
  symbol: 'ETH',
  decimals: 18,
};

const quote = {
  fromTokenInfo: nativeToken,
  toTokenInfo: {
    networkId: 'evm--1',
    contractAddress: '0xstock',
    isNative: false,
    symbol: 'STOCK',
    decimals: 18,
  },
  fromAmount: '1',
} as IFetchQuoteResult;

describe('swapStockTradeControl', () => {
  it('does not treat an incomplete empty-address token as the native quote owner', () => {
    expect(
      isQuoteResultForStockTrade({
        quoteResult: quote,
        sendToken: nativeToken,
        receiveToken: quote.toTokenInfo,
        sendAmount: '1.0',
      }),
    ).toBe(true);
    expect(
      isQuoteResultForStockTrade({
        quoteResult: quote,
        sendToken: { ...nativeToken, isNative: false },
        receiveToken: quote.toTokenInfo,
        sendAmount: '1.0',
      }),
    ).toBe(false);
  });
});
