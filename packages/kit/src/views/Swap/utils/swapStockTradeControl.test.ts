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
const currentScope = {
  currentAccountId: 'account-1',
  currentAddress: '0xsender',
  currentReceivingAddress: '0xrecipient',
};

describe('swapStockTradeControl', () => {
  it('matches a Stock quote request to its exact token and amount scope', () => {
    expect(
      isQuoteRequestForStockTrade({
        ...currentScope,
        quoteRequest: {
          type: ESwapTabSwitchType.STOCK,
          fromToken: payToken,
          toToken: stockToken,
          fromTokenAmount: '100.0',
          accountId: currentScope.currentAccountId,
          address: currentScope.currentAddress,
          receivingAddress: currentScope.currentReceivingAddress,
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
      accountId: currentScope.currentAccountId,
      address: currentScope.currentAddress,
      receivingAddress: currentScope.currentReceivingAddress,
    };

    expect(
      isQuoteRequestForStockTrade({
        ...currentScope,
        quoteRequest,
        receiveToken: stockToken,
        sendAmount: '100',
        sendToken: payToken,
      }),
    ).toBe(false);
    expect(
      isQuoteRequestForStockTrade({
        ...currentScope,
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

  it.each([
    ['account', { currentAccountId: 'account-2' }],
    ['sender', { currentAddress: '0xother-sender' }],
    ['recipient', { currentReceivingAddress: '0xother-recipient' }],
  ])('rejects a request from another %s scope', (_name, scopeOverride) => {
    expect(
      isQuoteRequestForStockTrade({
        ...currentScope,
        ...scopeOverride,
        quoteRequest: {
          type: ESwapTabSwitchType.STOCK,
          fromToken: payToken,
          toToken: stockToken,
          fromTokenAmount: '100',
          accountId: currentScope.currentAccountId,
          address: currentScope.currentAddress,
          receivingAddress: currentScope.currentReceivingAddress,
        },
        receiveToken: stockToken,
        sendAmount: '100',
        sendToken: payToken,
      }),
    ).toBe(false);
  });
});
