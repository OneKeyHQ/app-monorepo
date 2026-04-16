import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { attachUnknownTokenValueTip } from './unknownTokenValueTip';

function createQuoteResult(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    info: {
      provider: 'provider-a',
      providerName: 'Provider A',
    },
    fromTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0xfrom',
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
    },
    toTokenInfo: {
      networkId: 'evm--1',
      contractAddress: '0xto',
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
    },
    fromAmount: '1',
    toAmount: '1000',
    ...overrides,
  };
}

describe('attachUnknownTokenValueTip', () => {
  const quoteTip = {
    title: 'Unknown Token Value',
    detail: 'Unable to obtain token value',
    showCancelButton: true,
  };

  it('attaches the warning when the receive token price is unavailable', () => {
    const nextQuoteResult = attachUnknownTokenValueTip({
      quoteResult: createQuoteResult(),
      toTokenPrice: '0',
      quoteTip,
    });

    expect(nextQuoteResult.quoteShowTip).toEqual(quoteTip);
  });

  it('attaches the warning when the receive fiat value resolves to zero', () => {
    const nextQuoteResult = attachUnknownTokenValueTip({
      quoteResult: createQuoteResult({
        toAmount: '0.0000',
      }),
      toTokenPrice: '1',
      quoteTip,
    });

    expect(nextQuoteResult.quoteShowTip).toEqual(quoteTip);
  });

  it('does not attach the warning when the receive fiat value is positive', () => {
    const nextQuoteResult = attachUnknownTokenValueTip({
      quoteResult: createQuoteResult({
        toAmount: '0.0001',
      }),
      toTokenPrice: '1',
      quoteTip,
    });

    expect(nextQuoteResult.quoteShowTip).toBeUndefined();
  });

  it('does not override an existing quote tip', () => {
    const existingQuoteTip = {
      title: '40% value drop',
      detail: 'High price impact may cause your asset loss.',
      showCancelButton: true,
    };

    const nextQuoteResult = attachUnknownTokenValueTip({
      quoteResult: createQuoteResult({
        quoteShowTip: existingQuoteTip,
      }),
      toTokenPrice: '0',
      quoteTip,
    });

    expect(nextQuoteResult.quoteShowTip).toEqual(existingQuoteTip);
  });
});
