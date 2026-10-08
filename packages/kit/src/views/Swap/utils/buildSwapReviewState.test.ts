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
  resolveSwapReviewTokenAmounts,
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
  it.each(['evm--1', 'evm--56', 'evm--137', 'evm--42161'])(
    'returns batch approve and swap for a standard account on %s',
    (networkId) => {
      expect(
        buildSwapBatchTransferType({
          networkId,
          accountId: 'hd-1--m/44/60/0/0/0',
          batchApproveAndSwapEnabled: true,
          needApprove: true,
        }),
      ).toBe(ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP);
    },
  );

  it('keeps Tron approval transactions as separate steps', () => {
    expect(
      buildSwapBatchTransferType({
        networkId: 'tron--0x2b6653dc',
        accountId: 'hd-1--m/44/60/0/0/0',
        batchApproveAndSwapEnabled: true,
        needApprove: true,
      }),
    ).toBe(ESwapBatchTransferType.NORMAL);
  });

  it.each(['external--60--0xabc', "hw-1--m/44'/60'/0'/0/0"])(
    'waits between approval and swap for account %s',
    (accountId) => {
      expect(
        buildSwapBatchTransferType({
          networkId: fromToken.networkId,
          accountId,
          batchApproveAndSwapEnabled: true,
          needApprove: true,
        }),
      ).toBe(ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP);
    },
  );

  it('prioritizes the Tron separate-step requirement for hardware accounts', () => {
    expect(
      buildSwapBatchTransferType({
        networkId: 'tron--0x2b6653dc',
        accountId: "hw-1--m/44'/195'/0'/0/0",
        batchApproveAndSwapEnabled: true,
        needApprove: true,
      }),
    ).toBe(ESwapBatchTransferType.NORMAL);
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

describe('resolveSwapReviewTokenAmounts', () => {
  it('uses the selected quote output for Swap Pro Market review', () => {
    expect(
      resolveSwapReviewTokenAmounts({
        isSwapProMarket: true,
        swapProInputAmount: '1',
        swapFromAmount: 'stale-from-amount',
        swapToAmount: '',
        quoteToAmount: '0.9997',
      }),
    ).toEqual({
      fromTokenAmount: '1',
      toTokenAmount: '0.9997',
    });
  });

  it('keeps the regular Swap input atoms outside Swap Pro Market', () => {
    expect(
      resolveSwapReviewTokenAmounts({
        isSwapProMarket: false,
        swapProInputAmount: 'stale-pro-amount',
        swapFromAmount: '2',
        swapToAmount: '5000',
        quoteToAmount: 'stale-quote-amount',
      }),
    ).toEqual({
      fromTokenAmount: '2',
      toTokenAmount: '5000',
    });
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

  it.each([
    ['Bitcoin', 'btc--0', 'BTC'],
    ['Solana', 'sol--101', 'SOL'],
    ['Sui', 'sui--mainnet', 'SUI'],
  ])('keeps a no-approval %s swap as one send step', (_, networkId, symbol) => {
    const chainFromToken: ISwapToken = {
      networkId,
      contractAddress: '',
      symbol,
      decimals: 9,
      isNative: true,
    };
    const chainToToken: ISwapToken = {
      ...chainFromToken,
      contractAddress: 'token-address',
      symbol: 'TOKEN',
      isNative: false,
    };
    const result = buildSwapReviewState({
      accountId: 'hd-1--account',
      networkId,
      batchApproveAndSwapEnabled: true,
      fromToken: chainFromToken,
      toToken: chainToToken,
      fromTokenAmount: '1',
      toTokenAmount: '10',
      quoteResult: createQuoteResult({
        fromTokenInfo: chainFromToken,
        toTokenInfo: chainToToken,
      }),
      swapType: ESwapTabSwitchType.SWAP,
      shouldFallback: false,
      supportPreBuild: true,
      slippage: 1,
      texts,
    });

    expect(result.steps.map((step) => step.type)).toEqual([
      ESwapStepType.SEND_TX,
    ]);
    expect(result.preSwapData.needFetchGas).toBe(false);
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

  it('waits for external account approval before sending the swap', () => {
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
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SEND_TX,
    ]);
    expect(result.steps[0].shouldWaitApproved).toBe(true);
    expect(result.preSwapData.needFetchGas).toBe(true);
    expect(result.preSwapData.isHWAndExBatchTransfer).toBe(true);
  });

  it('waits for each external reset approval before sending the swap', () => {
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
          shouldResetApprove: true,
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
      ESwapStepType.APPROVE_TX,
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SEND_TX,
    ]);
    expect(result.steps[0]).toMatchObject({
      isResetApprove: true,
      shouldWaitApproved: true,
    });
    expect(result.steps[1]).toMatchObject({
      isResetApprove: false,
      shouldWaitApproved: true,
    });
    expect(result.preSwapData.needFetchGas).toBe(true);
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
});
