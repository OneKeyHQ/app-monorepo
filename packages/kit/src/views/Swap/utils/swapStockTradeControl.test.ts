import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { isQuoteRequestForStockTrade } from './swapStockTradeControl';

const payToken = {
  networkId: 'evm--56',
  contractAddress: '0xpay',
} as ISwapToken;
const stockToken = {
  networkId: 'evm--56',
  contractAddress: '0xstock',
} as ISwapToken;

describe('swapStockTradeControl', () => {
  it('matches a Stock quote request to its exact token and amount scope', () => {
    expect(
      isQuoteRequestForStockTrade({
        quoteRequest: {
          type: ESwapTabSwitchType.STOCK,
          fromToken: payToken,
          toToken: stockToken,
          fromTokenAmount: '100.0',
        },
        receiveToken: stockToken,
        sendAmount: '100',
        sendToken: payToken,
      }),
    ).toBe(true);
  });

  it('rejects an old amount or a non-Stock quote request', () => {
    const quoteRequest = {
      type: ESwapTabSwitchType.STOCK,
      fromToken: payToken,
      toToken: stockToken,
      fromTokenAmount: '99',
    };

    expect(
      isQuoteRequestForStockTrade({
        quoteRequest,
        receiveToken: stockToken,
        sendAmount: '100',
        sendToken: payToken,
      }),
    ).toBe(false);
    expect(
      isQuoteRequestForStockTrade({
        quoteRequest: {
          ...quoteRequest,
          type: ESwapTabSwitchType.SWAP,
          fromTokenAmount: '100',
        },
        receiveToken: stockToken,
        sendAmount: '100',
        sendToken: payToken,
      }),
    ).toBe(false);
  });
});
