import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  areMarketApproveAmountsEqual,
  assertMarketReviewQuoteResult,
  assertMarketSignPreviewInvariant,
  assertMarketSignedBuildInvariant,
  attachMarketOneInchFusionSignature,
  buildMarketApproveInfos,
  buildMarketSwapApprovingTransaction,
  buildWrappedMarketQuoteResult,
  canReuseMarketSigningQuoteResult,
  extractMarketSwapSuccessResult,
  normalizeMarketReviewQuoteResult,
} from './marketSwapReviewUtils';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

function createQuoteResult(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'onekey',
      providerName: 'OneKey',
    },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fromAmount: '1',
    toAmount: '2500',
    kind: ESwapQuoteKind.SELL,
    ...overrides,
  };
}

describe('marketSwapReviewUtils', () => {
  it('fails closed when review quote misses providerName', () => {
    expect(() =>
      assertMarketReviewQuoteResult(
        createQuoteResult({
          info: {
            provider: 'onekey',
            providerName: '',
          },
        }),
      ),
    ).toThrow('providerName');
  });

  it('matches approve amounts by numeric value instead of raw string only', () => {
    expect(areMarketApproveAmountsEqual('1.0', '1')).toBe(true);
    expect(areMarketApproveAmountsEqual('0.1000', '0.1')).toBe(true);
    expect(areMarketApproveAmountsEqual('1.01', '1')).toBe(false);
  });

  it('fails closed when a signed build result tries to continue on-chain sending', () => {
    expect(() =>
      assertMarketSignedBuildInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
          swapShouldSignedData: {
            unSignedInfo: {},
          } as never,
        }),
        rebuiltQuoteResult: createQuoteResult({
          minToAmount: '2400',
        }),
        skipSendTransAction: false,
      }),
    ).toThrow('signed order result');
  });

  it('fails closed when a signed build result changes provider, expected receive, or min receive', () => {
    expect(() =>
      assertMarketSignedBuildInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
        }),
        rebuiltQuoteResult: createQuoteResult({
          info: {
            provider: 'other',
            providerName: 'Other',
          },
          minToAmount: '2399',
        }),
        skipSendTransAction: true,
      }),
    ).toThrow('provider changed');

    expect(() =>
      assertMarketSignedBuildInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
          toAmount: '2500',
        }),
        rebuiltQuoteResult: createQuoteResult({
          minToAmount: '2400',
          toAmount: '2490',
        }),
        skipSendTransAction: true,
      }),
    ).toThrow('expected receive changed');

    expect(() =>
      assertMarketSignedBuildInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
        }),
        rebuiltQuoteResult: createQuoteResult({
          minToAmount: '2399',
        }),
        skipSendTransAction: true,
      }),
    ).toThrow('min receive changed');
  });

  it('fails closed when the signing quote changes after preview', () => {
    expect(() =>
      assertMarketSignPreviewInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
        }),
        signingQuoteResult: createQuoteResult({
          info: {
            provider: 'other',
            providerName: 'Other',
          },
        }),
      }),
    ).toThrow('provider changed before signing');

    expect(() =>
      assertMarketSignPreviewInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
        }),
        signingQuoteResult: createQuoteResult({
          fromAmount: '2',
        }),
      }),
    ).toThrow('amount changed before signing');

    expect(() =>
      assertMarketSignPreviewInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
        }),
        signingQuoteResult: createQuoteResult({
          toAmount: '2400',
        }),
      }),
    ).toThrow('expected receive changed before signing');

    expect(() =>
      assertMarketSignPreviewInvariant({
        reviewedQuoteResult: createQuoteResult({
          minToAmount: '2400',
        }),
        signingQuoteResult: createQuoteResult({
          minToAmount: '2399',
        }),
      }),
    ).toThrow('min receive changed before signing');
  });

  it('removes allowance when market speed check says approval is not needed', () => {
    const result = normalizeMarketReviewQuoteResult({
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
      }),
      shouldApprove: false,
      shouldResetApprove: false,
      spenderAddress: '0xspender',
      amount: '1',
    });

    expect(result.allowanceResult).toBeUndefined();
  });

  it('injects allowance using the effective spender when approval is required', () => {
    const result = normalizeMarketReviewQuoteResult({
      quoteResult: createQuoteResult(),
      shouldApprove: true,
      shouldResetApprove: true,
      spenderAddress: '0xspender',
      amount: '1',
    });

    expect(result.allowanceResult).toEqual({
      allowanceTarget: '0xspender',
      amount: '1',
      shouldResetApprove: true,
    });
  });

  it('builds reset approve plus final approve infos for batch review sends', () => {
    const approveInfos = buildMarketApproveInfos({
      fromUserAddress: '0xuser',
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
          shouldResetApprove: true,
        },
      }),
    });

    expect(approveInfos).toHaveLength(2);
    expect(approveInfos[0].amount).toBe('0');
    expect(approveInfos[0].isMax).toBe(false);
    expect(approveInfos[1].amount).toBe('1');
    expect(approveInfos[1].isMax).toBe(true);
  });

  it('fails closed when one-inch fusion context is missing', () => {
    expect(() =>
      attachMarketOneInchFusionSignature({
        quoteResult: createQuoteResult({
          quoteResultCtx: undefined,
        }),
        signature: '0xsig',
      }),
    ).toThrow('1inch fusion context missing');
  });

  it('attaches the one-inch fusion signature when the context is present', () => {
    const quoteResult = createQuoteResult({
      quoteResultCtx: {
        oneInchFusionOrderCtx: {
          orderStruct: { salt: '1' },
          extension: '0xext',
          quoteId: 'quote-1',
          orderHash: '0xhash',
        },
      },
    });

    const result = attachMarketOneInchFusionSignature({
      quoteResult,
      signature: '0xsig',
    });

    expect(result.quoteResultCtx.oneInchFusionOrderCtx).toEqual({
      orderStruct: { salt: '1' },
      extension: '0xext',
      quoteId: 'quote-1',
      orderHash: '0xhash',
      signature: '0xsig',
    });
  });

  it('returns a new quote result instead of mutating the original fusion context', () => {
    const quoteResult = createQuoteResult({
      quoteResultCtx: {
        oneInchFusionOrderCtx: {
          orderStruct: { salt: '1' },
          extension: '0xext',
          quoteId: 'quote-1',
          orderHash: '0xhash',
        },
      },
    });
    const originalQuoteResultCtx = quoteResult.quoteResultCtx;
    const originalOrderCtx = originalQuoteResultCtx?.oneInchFusionOrderCtx;

    const result = attachMarketOneInchFusionSignature({
      quoteResult,
      signature: '0xsig',
    });

    expect(result).not.toBe(quoteResult);
    expect(result.quoteResultCtx).not.toBe(originalQuoteResultCtx);
    expect(result.quoteResultCtx.oneInchFusionOrderCtx).not.toBe(
      originalOrderCtx,
    );
    expect(quoteResult.quoteResultCtx?.oneInchFusionOrderCtx).toEqual({
      orderStruct: { salt: '1' },
      extension: '0xext',
      quoteId: 'quote-1',
      orderHash: '0xhash',
    });
    expect(result.quoteResultCtx.oneInchFusionOrderCtx).toEqual({
      orderStruct: { salt: '1' },
      extension: '0xext',
      quoteId: 'quote-1',
      orderHash: '0xhash',
      signature: '0xsig',
    });
  });

  it('reuses the reviewed signing quote when the required signing context is already present', () => {
    expect(
      canReuseMarketSigningQuoteResult(
        createQuoteResult({
          swapShouldSignedData: {
            oneInchFusionOrder: {
              makerAddress: '0xmaker',
              typedData: {},
            },
          } as never,
          quoteResultCtx: {
            oneInchFusionOrderCtx: {
              orderStruct: { salt: '1' },
              extension: '0xext',
              quoteId: 'quote-1',
              orderHash: '0xhash',
            },
          },
        }),
      ),
    ).toBe(true);

    expect(
      canReuseMarketSigningQuoteResult(
        createQuoteResult({
          swapShouldSignedData: {
            unSignedInfo: {},
            unSignedData: {},
          } as never,
          quoteResultCtx: {
            cowSwapUnSignedOrder: {
              receiver: '0xreceiver',
            },
          },
        }),
      ),
    ).toBe(true);

    expect(
      canReuseMarketSigningQuoteResult(
        createQuoteResult({
          swapShouldSignedData: {
            oneInchFusionOrder: {
              makerAddress: '0xmaker',
              typedData: {},
            },
          } as never,
          quoteResultCtx: undefined,
        }),
      ),
    ).toBe(false);
  });

  it('builds a review-visible approving transaction payload', () => {
    const result = buildMarketSwapApprovingTransaction({
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
      }),
      amount: '1',
      useAddress: '0xuser',
      spenderAddress: '0xspender',
    });

    expect(result.status).toBe(ESwapApproveTransactionStatus.PENDING);
    expect(result.providerName).toBe('OneKey');
    expect(result.resetApproveValue).toBe('0');
  });

  it('builds a wrapped quote result for wrap review flows', () => {
    const result = buildWrappedMarketQuoteResult({
      fromToken,
      toToken,
      amount: '2',
      providerLogo: 'wrapped-logo',
    });

    expect(result.isWrapped).toBe(true);
    expect(result.toAmount).toBe('2');
    expect(result.info.providerLogo).toBe('wrapped-logo');
  });

  it('extracts the final swap transaction from batched send results', () => {
    const result = extractMarketSwapSuccessResult([
      {
        signedTx: {
          encodedTx: null,
          txid: '0xapprove',
          rawTx: '0xapprove-raw',
        },
        decodedTx: {},
      } as ISendTxOnSuccessData,
      {
        signedTx: {
          encodedTx: null,
          txid: '0xswap',
          rawTx: '0xswap-raw',
          swapInfo: {} as never,
        },
        decodedTx: {
          totalFeeFiatValue: '12.3',
          totalFeeInNative: '0.01',
        } as never,
      } as ISendTxOnSuccessData,
    ]);

    expect(result).toEqual({
      txHash: '0xswap',
      gasFeeFiatValue: '12.3',
      gasFeeInNative: '0.01',
    });
  });
});
