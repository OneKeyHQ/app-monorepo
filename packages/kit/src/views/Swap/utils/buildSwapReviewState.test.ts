import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapBatchTransferType,
  ESwapRateDifferenceUnit,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapBatchTransferType,
  buildSwapReviewExecutionFingerprint,
  buildSwapReviewState,
} from './buildSwapReviewState';
import { ESwapExecutionRecipientMode } from './swapReviewState';

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

const texts = {
  wrap: 'Wrap',
  approveAndSwap: 'Approve and Swap',
  approveAndSign: 'Approve and Sign',
  revokeApprove: 'Revoke Approve',
  approveToken: 'Approve ETH',
  approveTokenWithTarget: 'Approve ETH for OneKey',
  signAndSubmit: 'Sign and Submit',
  sign: 'Sign',
  confirmSwap: 'Confirm Swap',
  swap: 'Swap',
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
    ...overrides,
  };
}

describe('buildSwapBatchTransferType', () => {
  it('returns batch approve and swap for standard accounts when enabled', () => {
    expect(
      buildSwapBatchTransferType({
        networkId: fromToken.networkId,
        accountId: 'hd-1--m/44/60/0/0/0',
        batchApproveAndSwapEnabled: true,
        needApprove: true,
      }),
    ).toBe(ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP);
  });

  it('returns continuous approve and swap for external accounts', () => {
    expect(
      buildSwapBatchTransferType({
        networkId: fromToken.networkId,
        accountId: 'external--60--0xabc',
        batchApproveAndSwapEnabled: true,
        needApprove: true,
      }),
    ).toBe(ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP);
  });

  it('downgrades to normal when the provider disables batch transfer', () => {
    expect(
      buildSwapBatchTransferType({
        networkId: fromToken.networkId,
        accountId: 'hd-1--m/44/60/0/0/0',
        batchApproveAndSwapEnabled: true,
        needApprove: true,
        providerDisableBatchTransfer: true,
      }),
    ).toBe(ESwapBatchTransferType.NORMAL);
  });
});

describe('buildSwapReviewState', () => {
  it('builds a normal send flow', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult(),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      rateDifference: {
        value: '-12.34%',
        unit: ESwapRateDifferenceUnit.NEGATIVE,
      },
      texts,
    });

    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.SEND_TX,
    ]);
    expect(result.preSwapData.needFetchGas).toBe(false);
    expect(result.preSwapData.supportNetworkFeeLevel).toBe(true);
    expect(result.preSwapData.rateDifference).toEqual({
      value: '-12.34%',
      unit: ESwapRateDifferenceUnit.NEGATIVE,
    });
  });

  it('builds a wrap flow', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '1',
      quoteResult: createQuoteResult({
        isWrapped: true,
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: false,
      slippage: 1,
      texts,
    });

    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.WRAP_TX,
    ]);
    expect(result.steps[0].stepTitle).toBe(texts.wrap);
  });

  it('builds an approve and sign flow', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
        swapShouldSignedData: {
          unSignedInfo: {
            origin: 'origin',
            scope: 'scope',
            signedType: 'eth_signTypedData_v4' as never,
          },
        },
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SIGN_MESSAGE,
    ]);
    expect(result.preSwapData.supportNetworkFeeLevel).toBe(true);
  });

  it('keeps network fee hidden for pure signing flows', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        swapShouldSignedData: {
          unSignedInfo: {
            origin: 'origin',
            scope: 'scope',
            signedType: 'eth_signTypedData_v4' as never,
          },
        },
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.SIGN_MESSAGE,
    ]);
    expect(result.preSwapData.supportNetworkFeeLevel).toBeUndefined();
  });

  it('builds an approve and send flow', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: false,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SEND_TX,
    ]);
    expect(result.preSwapData.needFetchGas).toBe(true);
  });

  it('builds a reset approve flow', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: false,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
          shouldResetApprove: true,
        },
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SEND_TX,
    ]);
    expect(result.steps[0].isResetApprove).toBe(true);
    expect(result.steps[1].isResetApprove).toBe(false);
  });

  it('builds a batch approve and swap flow', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.batchTransferType).toBe(
      ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP,
    );
    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.BATCH_APPROVE_SWAP,
    ]);
    expect(result.preSwapData.needFetchGas).toBe(false);
  });

  it('builds a continuous approve and swap flow for external accounts', () => {
    const result = buildSwapReviewState({
      accountId: 'external--60--0xabc',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.batchTransferType).toBe(
      ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP,
    );
    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.BATCH_APPROVE_SWAP,
    ]);
    expect(result.steps[0].stepTitle).toContain('[ 0 / 2 ]');
    expect(result.preSwapData.isHWAndExBatchTransfer).toBe(true);
  });

  it('downgrades provider-disabled batch transfer to approve and send', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: true,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '1',
        },
        providerDisableBatchTransfer: true,
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.batchTransferType).toBe(ESwapBatchTransferType.NORMAL);
    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SEND_TX,
    ]);
  });

  it('removes slippage when the quote does not support it', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: false,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        unSupportSlippage: true,
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: true,
      supportPreBuild: true,
      slippage: 2,
      texts,
    });

    expect(result.preSwapData.slippage).toBeUndefined();
    expect(result.preSwapData.shouldFallback).toBe(true);
  });

  it('hides slippage for stock quotes', () => {
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: false,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        protocol: EProtocolOfExchange.STOCK,
        unSupportSlippage: true,
      }),
      swapType: ESwapTabSwitchType.STOCK,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 2,
      texts,
    });

    expect(result.preSwapData.slippage).toBeUndefined();
    expect(result.preSwapData.unSupportSlippage).toBe(true);
  });

  it('adds immutable quote provenance from the accepted executable quote', () => {
    const quoteCommittedAt = 1_000_000;
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: false,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        eventId: 'event-1',
        quoteId: 'quote-1',
        fromAmount: '1',
        toAmount: '2500',
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      quoteRequestId: 'request-1',
      quoteIntentRevision: 7,
      quoteCommittedAt,
      texts,
    });

    expect(result.provenance.quoteRequestId).toBe('request-1');
    expect(result.provenance.quoteIntentRevision).toBe(7);
    expect(result.provenance.quoteCommittedAt).toBe(quoteCommittedAt);
    expect(result.provenance.executionFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(result.provenance)).toBe(true);

    const resultWithoutClientRequestId = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({ eventId: 'server-event-1' }),
      swapType: ESwapTabSwitchType.SWAP,
      supportPreBuild: true,
      texts,
    });
    expect(
      resultWithoutClientRequestId.provenance.quoteRequestId,
    ).toBeUndefined();
  });

  it('builds stable fingerprints and changes them for execution semantics', () => {
    const baseInput = {
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      batchApproveAndSwapEnabled: false,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        eventId: 'event-1',
        quoteId: 'quote-1',
        fromAmount: '1',
        toAmount: '2500',
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
    };
    const fingerprint = buildSwapReviewExecutionFingerprint(baseInput);

    expect(buildSwapReviewExecutionFingerprint({ ...baseInput })).toBe(
      fingerprint,
    );
    expect(
      buildSwapReviewExecutionFingerprint({
        ...baseInput,
        accountId: 'hd-2--m/44/60/0/0/0',
      }),
    ).not.toBe(fingerprint);
    expect(
      buildSwapReviewExecutionFingerprint({
        ...baseInput,
        fromTokenAmount: '2',
      }),
    ).not.toBe(fingerprint);
    expect(
      buildSwapReviewExecutionFingerprint({
        ...baseInput,
        slippage: 2,
      }),
    ).not.toBe(fingerprint);
    expect(
      buildSwapReviewExecutionFingerprint({
        ...baseInput,
        quoteResult: createQuoteResult({
          ...baseInput.quoteResult,
          info: {
            provider: 'other',
            providerName: 'Other',
          },
        }),
      }),
    ).not.toBe(fingerprint);
    expect(
      buildSwapReviewExecutionFingerprint({
        ...baseInput,
        fromToken: {
          ...fromToken,
          networkId: 'sol--101',
          contractAddress: 'AbCDefGhijk',
        },
      }),
    ).not.toBe(
      buildSwapReviewExecutionFingerprint({
        ...baseInput,
        fromToken: {
          ...fromToken,
          networkId: 'sol--101',
          contractAddress: 'abcdefghijk',
        },
      }),
    );
  });

  it('keeps LIMIT order semantics in the frozen review identity', () => {
    const baseInput = {
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        protocol: EProtocolOfExchange.LIMIT,
        fromAmount: '1',
        toAmount: '2500',
      }),
      swapType: ESwapTabSwitchType.LIMIT,
      supportPreBuild: false,
      slippage: 1,
      executionContext: {
        reviewRevision: 'review-limit-1',
        senderAddress: '0xsender',
        receivingAddress: '0xreceiver',
        recipientMode: ESwapExecutionRecipientMode.Custom,
        limitSettings: {
          expirationTime: '3600',
          rate: '2500',
          priceFromAmount: '1',
          priceToAmount: '2500',
          partiallyFillable: true,
        },
      },
      texts,
    };
    const result = buildSwapReviewState(baseInput);
    const fingerprint = result.provenance.executionFingerprint;

    expect(result.executionSnapshot?.limitSettings).toEqual(
      baseInput.executionContext.limitSettings,
    );
    expect(
      buildSwapReviewState({
        ...baseInput,
        executionContext: {
          ...baseInput.executionContext,
          limitSettings: {
            ...baseInput.executionContext.limitSettings,
            rate: '2600',
          },
        },
      }).provenance.executionFingerprint,
    ).not.toBe(fingerprint);
    expect(
      buildSwapReviewState({
        ...baseInput,
        executionContext: {
          ...baseInput.executionContext,
          limitSettings: {
            ...baseInput.executionContext.limitSettings,
            expirationTime: '7200',
            partiallyFillable: false,
          },
        },
      }).provenance.executionFingerprint,
    ).not.toBe(fingerprint);
  });

  it('deep-freezes a detached execution snapshot', () => {
    const quote = createQuoteResult({
      fromAmount: '1',
      toAmount: '2500',
      quoteResultCtx: { nested: { value: 'original' } },
    });
    const result = buildSwapReviewState({
      accountId: 'hd-1--m/44/60/0/0/0',
      networkId: fromToken.networkId,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: quote,
      swapType: ESwapTabSwitchType.SWAP,
      supportPreBuild: true,
      slippage: 1,
      executionContext: {
        reviewRevision: 'review-1',
        senderAddress: '0xsender',
        receivingAddress: '0xreceiver',
        receivingAccountId: 'account-2',
        recipientMode: ESwapExecutionRecipientMode.Account,
        limitSettings: {
          expirationTime: '3600',
          priceFromAmount: '',
          priceToAmount: '',
          partiallyFillable: true,
        },
      },
      texts,
    });
    const snapshot = result.executionSnapshot;

    expect(snapshot).toBeDefined();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot?.quoteResult)).toBe(true);
    expect(Object.isFrozen(snapshot?.quoteResult.info)).toBe(true);
    expect(Object.isFrozen(snapshot?.quoteResult.quoteResultCtx)).toBe(true);
    expect(() => {
      if (snapshot) {
        snapshot.quoteResult.info.provider = 'mutated';
      }
    }).toThrow();
    expect(quote.info.provider).toBe('onekey');
  });
});
