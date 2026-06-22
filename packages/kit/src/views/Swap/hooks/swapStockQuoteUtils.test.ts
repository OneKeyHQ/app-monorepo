import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { isQuoteResultForStockTrade } from './swapStockQuoteUtils';

const sendToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const receiveToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
};

const quoteResult = {
  fromAmount: '1000',
  fromTokenInfo: sendToken,
  info: { provider: 'stock' },
  toAmount: '10',
  toTokenInfo: receiveToken,
} as IFetchQuoteResult;

describe('swapStockQuoteUtils', () => {
  it('matches the quote to the current stock tokens and input amount', () => {
    expect(
      isQuoteResultForStockTrade({
        quoteResult,
        receiveToken,
        sendAmount: '1000.0',
        sendToken,
      }),
    ).toBe(true);
  });

  it('rejects stale quotes for a previous stock input amount', () => {
    expect(
      isQuoteResultForStockTrade({
        quoteResult,
        receiveToken,
        sendAmount: '5',
        sendToken,
      }),
    ).toBe(false);
  });

  it('rejects quotes without a dispatch-time input amount', () => {
    const { fromAmount, ...quoteWithoutFromAmount } = quoteResult;

    expect(
      isQuoteResultForStockTrade({
        quoteResult: quoteWithoutFromAmount as IFetchQuoteResult,
        receiveToken,
        sendAmount: '1000',
        sendToken,
      }),
    ).toBe(false);
  });
});
