import type { ISwapInputAmountDraft } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapSource } from '@onekeyhq/shared/types/swap/types';

import { buildMarketEmbeddedSwapInitParams } from './marketEmbeddedSwapUtils';

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
});
