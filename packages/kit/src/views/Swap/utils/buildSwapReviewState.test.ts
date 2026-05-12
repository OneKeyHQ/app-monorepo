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
  buildSwapReviewState,
} from './buildSwapReviewState';

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
});
