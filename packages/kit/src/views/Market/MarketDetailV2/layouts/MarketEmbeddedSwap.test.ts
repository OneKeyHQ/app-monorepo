import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import {
  buildMarketEmbeddedSwapInitParams,
  isDraftAmountRestorable,
} from './marketEmbeddedSwapUtils';

const bnb: ISwapToken = {
  contractAddress: '',
  decimals: 18,
  isNative: true,
  logoURI: 'https://example.com/bnb.png',
  networkId: 'evm--56',
  symbol: 'BNB',
};
const marketToken: ISwapToken = {
  contractAddress: '0xmarket',
  decimals: 18,
  isNative: false,
  logoURI: 'https://example.com/market.png',
  networkId: 'evm--56',
  symbol: 'MARKET',
};
const stockMarketToken: ISwapToken = {
  ...marketToken,
  isStock: true,
};
const btc: ISwapToken = {
  contractAddress: '',
  decimals: 8,
  isNative: true,
  networkId: 'btc--0',
  symbol: 'BTC',
};
const eth: ISwapToken = {
  contractAddress: '',
  decimals: 18,
  isNative: true,
  networkId: 'evm--1',
  symbol: 'ETH',
};
const usdc: ISwapToken = {
  contractAddress: '0xusdc',
  decimals: 6,
  isNative: false,
  networkId: 'evm--1',
  symbol: 'USDC',
};
const nextMarketToken: ISwapToken = {
  contractAddress: '0xnext',
  decimals: 18,
  isNative: false,
  networkId: 'evm--1',
  symbol: 'NEXT',
};

describe('buildMarketEmbeddedSwapInitParams', () => {
  it('does not initialize shared Swap before a complete pair exists', () => {
    expect(
      buildMarketEmbeddedSwapInitParams({
        defaultTokens: [marketToken],
        swapToken: marketToken,
      }),
    ).toBeUndefined();
  });

  it('seeds both sides before shared Swap mounts', () => {
    expect(
      buildMarketEmbeddedSwapInitParams({
        defaultTokens: [bnb, marketToken],
        swapToken: marketToken,
      }),
    ).toMatchObject({
      importFromToken: bnb,
      importNetworkId: bnb.networkId,
      importToToken: marketToken,
      swapSource: ESwapSource.MARKET,
    });
  });

  it('keeps a valid saved draft pair', () => {
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: marketToken,
      fromTokenAmount: { isInput: true, value: '12' },
      toToken: bnb,
      toTokenAmount: { isInput: false, value: '' },
    };

    expect(
      buildMarketEmbeddedSwapInitParams({
        defaultTokens: [bnb, marketToken],
        inputDraft,
        swapToken: marketToken,
      }),
    ).toMatchObject({
      importFromToken: marketToken,
      importToToken: bnb,
    });
  });

  it('uses the latest stock variant while preserving the draft payment token', () => {
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: bnb,
      fromTokenAmount: { isInput: true, value: '12' },
      toToken: { ...stockMarketToken, networkId: 'evm--1' },
      toTokenAmount: { isInput: false, value: '' },
    };

    expect(
      buildMarketEmbeddedSwapInitParams({
        defaultTokens: [bnb, stockMarketToken],
        inputDraft,
        swapToken: { ...stockMarketToken, networkId: 'evm--56' },
      }),
    ).toMatchObject({
      importFromToken: bnb,
      importToToken: { ...stockMarketToken, networkId: 'evm--56' },
    });
  });

  it('keeps a saved draft pair whose pay token is on another network', () => {
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: btc,
      fromTokenAmount: { isInput: true, value: '0.00056' },
      toToken: eth,
      toTokenAmount: { isInput: false, value: '' },
    };

    expect(
      buildMarketEmbeddedSwapInitParams({
        defaultTokens: [eth, usdc],
        inputDraft,
        swapToken: btc,
      }),
    ).toMatchObject({
      importFromToken: btc,
      importNetworkId: btc.networkId,
      importToToken: eth,
    });
  });

  it('restores a user-selected pair that no longer holds the Market token', () => {
    // Market detail for NEXT; the user switched the receive token to USDC, so
    // the draft no longer holds NEXT. It is the user's own choice under this
    // inputDraftKey, and must survive a blur/refocus.
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: eth,
      fromTokenAmount: { isInput: true, value: '1' },
      toToken: usdc,
      toTokenAmount: { isInput: false, value: '' },
    };

    expect(
      buildMarketEmbeddedSwapInitParams({
        defaultTokens: [eth, usdc],
        inputDraft,
        swapToken: nextMarketToken,
      }),
    ).toMatchObject({
      importFromToken: eth,
      importToToken: usdc,
    });
  });

  it('reuses only the pay token of a draft without a resolved pair', () => {
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: usdc,
      fromTokenAmount: { isInput: true, value: '1' },
      toToken: undefined,
      toTokenAmount: { isInput: false, value: '' },
    };

    expect(
      buildMarketEmbeddedSwapInitParams({
        defaultTokens: [eth, usdc],
        inputDraft,
        swapToken: nextMarketToken,
      }),
    ).toMatchObject({
      importFromToken: usdc,
      importToToken: nextMarketToken,
    });
  });

  it('forwards the retained amount only for the pair that produced it', () => {
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: btc,
      fromTokenAmount: { isInput: true, value: '0.00056' },
      toToken: eth,
      toTokenAmount: { isInput: false, value: '' },
    };
    const params = buildMarketEmbeddedSwapInitParams({
      defaultTokens: [eth, usdc],
      inputDraft,
      swapToken: btc,
    });

    expect(isDraftAmountRestorable(inputDraft, params)).toBe(true);
    expect(
      isDraftAmountRestorable(inputDraft, {
        ...params,
        importFromToken: usdc,
      }),
    ).toBe(false);
    expect(
      isDraftAmountRestorable(inputDraft, {
        ...params,
        importToToken: usdc,
      }),
    ).toBe(false);
  });

  it('never forwards an amount from a draft without a resolved pair', () => {
    const inputDraft: ISwapInputAmountDraft = {
      fromToken: btc,
      fromTokenAmount: { isInput: true, value: '0.00056' },
      toToken: undefined,
      toTokenAmount: { isInput: false, value: '' },
    };
    const params = buildMarketEmbeddedSwapInitParams({
      defaultTokens: [eth, usdc],
      inputDraft,
      swapToken: nextMarketToken,
    });

    expect(params).toBeDefined();
    expect(isDraftAmountRestorable(inputDraft, params)).toBe(false);
    expect(isDraftAmountRestorable(inputDraft, undefined)).toBe(false);
    expect(isDraftAmountRestorable(undefined, params)).toBe(false);
  });
});
