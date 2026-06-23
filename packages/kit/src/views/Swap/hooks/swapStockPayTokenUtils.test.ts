import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  shouldRefreshStockPayTokensForHistoryEvent,
  shouldSyncStockPayTokenDetail,
} from './swapStockPayTokenUtils';

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

const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xstock',
  symbol: 'STRCon',
  decimals: 18,
  isStock: true,
};

describe('swapStockPayTokenUtils', () => {
  it('refreshes pay tokens when a history event contains a pay token', () => {
    expect(
      shouldRefreshStockPayTokensForHistoryEvent({
        fromToken: stockToken,
        rawPayTokens: [usdcToken, usdtToken],
        toToken: usdtToken,
      }),
    ).toBe(true);
  });

  it('does not refresh pay tokens for unrelated history events', () => {
    expect(
      shouldRefreshStockPayTokensForHistoryEvent({
        fromToken: stockToken,
        rawPayTokens: [usdcToken, usdtToken],
        toToken: ethToken,
      }),
    ).toBe(false);
  });

  it('syncs selected pay token detail when the balance changes', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balance: '0',
          balanceParsed: '0',
          fiatValue: '0',
          price: '1',
        },
        nextToken: {
          ...usdcToken,
          balance: '1.25',
          balanceParsed: '1.25',
          fiatValue: '1.25',
          price: '1',
        },
      }),
    ).toBe(true);
  });

  it('does not sync selected pay token detail when token identity differs', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balanceParsed: '0',
        },
        nextToken: {
          ...usdtToken,
          balanceParsed: '1',
        },
      }),
    ).toBe(false);
  });

  it('does not sync selected pay token detail when detail fields are unchanged', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          fiatValue: '2',
          price: '1',
        },
        nextToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          fiatValue: '2',
          price: '1',
        },
      }),
    ).toBe(false);
  });

  it('syncs selected pay token detail when the price currency is added', () => {
    expect(
      shouldSyncStockPayTokenDetail({
        currentToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          fiatValue: '2',
          price: '1',
        },
        nextToken: {
          ...usdcToken,
          balance: '2',
          balanceParsed: '2',
          currency: 'usd',
          fiatValue: '2',
          price: '1',
        },
      }),
    ).toBe(true);
  });
});
