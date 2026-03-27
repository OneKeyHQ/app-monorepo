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
  assertMarketReviewQuoteResult,
  buildMarketApproveInfos,
  buildMarketSwapApprovingTransaction,
  buildWrappedMarketQuoteResult,
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
