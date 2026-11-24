import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../hooks/useTradeType';

import {
  getMarketTradeFallbackInput,
  resolveMarketTradeActionState,
  resolveMarketTradeFallbackSwapType,
} from './ActionButton.utils';

describe('getMarketTradeFallbackInput', () => {
  const marketToken: ISwapToken = {
    networkId: 'btc--0',
    contractAddress: '',
    symbol: 'BTC',
    decimals: 8,
    isNative: true,
  };
  const paymentToken: ISwapToken = {
    networkId: 'evm--1',
    contractAddress: '0x1234',
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  };

  it('opens Buy with the Market token when no payment token is available', () => {
    expect(
      getMarketTradeFallbackInput({
        marketToken,
        tokenMetadataReady: false,
        tradeType: ESwapDirection.BUY,
        amount: '10',
      }),
    ).toEqual({
      fromAmount: '',
      importFromToken: undefined,
      importToToken: marketToken,
      marketPresetToken: {
        networkId: 'btc--0',
        contractAddress: '',
        isNative: true,
      },
    });
  });

  it.each([false, true])(
    'imports the Sell amount only for a verified pair (%s)',
    (tokenMetadataReady) => {
      expect(
        getMarketTradeFallbackInput({
          marketToken,
          paymentToken,
          tokenMetadataReady,
          tradeType: ESwapDirection.SELL,
          amount: '0.01',
        }),
      ).toMatchObject({
        fromAmount: tokenMetadataReady ? '0.01' : '',
        importFromToken: marketToken,
        importToToken: tokenMetadataReady ? paymentToken : undefined,
      });
    },
  );
});

describe('resolveMarketTradeFallbackSwapType', () => {
  it('routes stock tokens to the Trade Stocks channel', () => {
    expect(
      resolveMarketTradeFallbackSwapType({
        isStock: true,
        onlySupportCrossChain: true,
      }),
    ).toBe(ESwapTabSwitchType.STOCK);
  });

  it('preserves the existing bridge and swap fallbacks', () => {
    expect(
      resolveMarketTradeFallbackSwapType({ onlySupportCrossChain: true }),
    ).toBe(ESwapTabSwitchType.BRIDGE);
    expect(resolveMarketTradeFallbackSwapType({})).toBe(
      ESwapTabSwitchType.SWAP,
    );
  });
});

describe('resolveMarketTradeActionState', () => {
  it('keeps wrapped pairs in Market when speed swap is unsupported', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isBalanceAvailable: true,
        isInsufficientBalance: false,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: false });
  });

  it('falls back to Swap for wrapped pairs on unsupported accounts', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: false,
        isBalanceAvailable: true,
        isInsufficientBalance: false,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('falls back to Swap for unsupported ordinary pairs', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isBalanceAvailable: true,
        isInsufficientBalance: false,
        isWrapped: false,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('refreshes an expired quote instead of falling back or blocking on balance', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: false,
        isBalanceAvailable: true,
        isInsufficientBalance: true,
        isWrapped: false,
        isRefreshQuote: true,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: false });
  });

  it('disables insufficient ordinary pairs instead of falling back to Swap', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: true,
        isAccountNetworkSupported: true,
        isBalanceAvailable: true,
        isInsufficientBalance: true,
        isWrapped: false,
      }),
    ).toEqual({ shouldDisable: true, shouldJumpToSwap: false });
  });

  it('preserves unsupported pair fallback when balance is insufficient', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isBalanceAvailable: true,
        isInsufficientBalance: true,
        isWrapped: false,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('preserves account compatibility fallback when balance is unavailable', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: false,
        isBalanceAvailable: false,
        isInsufficientBalance: false,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: false, shouldJumpToSwap: true });
  });

  it('disables insufficient wrapped pairs for supported accounts', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isBalanceAvailable: true,
        isInsufficientBalance: true,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: true, shouldJumpToSwap: false });
  });

  it('disables wrapped pairs while balance is unavailable', () => {
    expect(
      resolveMarketTradeActionState({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
        isBalanceAvailable: false,
        isInsufficientBalance: false,
        isWrapped: true,
      }),
    ).toEqual({ shouldDisable: true, shouldJumpToSwap: false });
  });
});
