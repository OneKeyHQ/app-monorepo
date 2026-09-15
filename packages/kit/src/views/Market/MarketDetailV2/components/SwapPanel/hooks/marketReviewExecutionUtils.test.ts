import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type {
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildMarketReviewState,
  findMarketTxConfirmFeeInfo,
  shouldAutoContinueMarketResetApprove,
  shouldSkipMarketSignedPrebuild,
} from './marketReviewExecutionUtils';

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
  approveToken: 'Approve Token',
  approveTokenWithTarget: 'Approve Token',
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
    fromAmount: '1',
    toAmount: '2500',
    ...overrides,
  };
}

describe('marketReviewExecutionUtils', () => {
  it('keeps the Market review flow on separate approve then send steps', () => {
    const reviewState = buildMarketReviewState({
      accountId: 'account-1',
      networkId: fromToken.networkId,
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
      slippage: 1,
      texts,
    });

    expect(reviewState.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SEND_TX,
    ]);
  });

  it('marks cross-network Market review state as Bridge', () => {
    const reviewState = buildMarketReviewState({
      accountId: 'account-1',
      networkId: fromToken.networkId,
      fromToken,
      toToken: {
        ...toToken,
        networkId: 'evm--137',
      },
      fromTokenAmount: '1',
      toTokenAmount: '2500',
      quoteResult: createQuoteResult({
        toTokenInfo: {
          ...toToken,
          networkId: 'evm--137',
        },
      }),
      slippage: 1,
      texts,
    });

    expect(reviewState.preSwapData.swapType).toBe(ESwapTabSwitchType.BRIDGE);
  });

  it('keeps wrap preview prebuild enabled so fee switching stays connected', () => {
    const reviewState = buildMarketReviewState({
      accountId: 'account-1',
      networkId: fromToken.networkId,
      fromToken,
      toToken,
      fromTokenAmount: '1',
      toTokenAmount: '1',
      quoteResult: createQuoteResult({
        isWrapped: true,
        toAmount: '1',
      }),
      slippage: 1,
      texts,
    });

    expect(reviewState.preSwapData.supportPreBuild).toBe(true);
    expect(reviewState.preSwapData.supportNetworkFeeLevel).toBe(true);
  });

  it('keeps approve fee editing visible for approve and sign flows', () => {
    const reviewState = buildMarketReviewState({
      accountId: 'account-1',
      networkId: fromToken.networkId,
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
        } as never,
      }),
      slippage: 1,
      texts,
    });

    expect(reviewState.steps.map((step) => step.type)).toEqual([
      ESwapStepType.APPROVE_TX,
      ESwapStepType.SIGN_MESSAGE,
    ]);
    expect(reviewState.preSwapData.supportNetworkFeeLevel).toBe(true);
  });

  it('matches the selected tx fee info by encoded tx', () => {
    const feeInfo = findMarketTxConfirmFeeInfo({
      gasInfos: [
        {
          encodeTx: {
            data: '0xapprove',
          } as IEncodedTx,
          gasInfo: {
            common: {
              feeDecimals: 18,
              feeSymbol: 'ETH',
              nativeDecimals: 18,
              nativeSymbol: 'ETH',
            },
            gas: {
              gasPrice: '1',
              gasLimit: '21000',
            },
          } as never,
        },
        {
          encodeTx: {
            data: '0xswap',
          } as IEncodedTx,
          gasInfo: {
            common: {
              feeDecimals: 18,
              feeSymbol: 'ETH',
              nativeDecimals: 18,
              nativeSymbol: 'ETH',
            },
            gas: {
              gasPrice: '3',
              gasLimit: '23000',
            },
          } as never,
        },
      ],
      encodedTx: {
        data: '0xswap',
      } as IEncodedTx,
    });

    expect(feeInfo?.gas?.gasPrice).toBe('3');
  });

  it('auto-continues reset approve only after the review dialog is closed', () => {
    const approvedSwapInfo: ISwapApproveTransaction = {
      fromToken,
      toToken,
      protocol: EProtocolOfExchange.SWAP,
      swapType: 'swap' as never,
      provider: 'onekey',
      providerName: 'OneKey',
      useAddress: '0xuser',
      spenderAddress: '0xspender',
      amount: '1',
      status: ESwapApproveTransactionStatus.SUCCESS,
      resetApproveValue: '1',
    };

    expect(
      shouldAutoContinueMarketResetApprove({
        approvedSwapInfo,
        isReviewDialogOpen: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoContinueMarketResetApprove({
        approvedSwapInfo,
        isReviewDialogOpen: false,
      }),
    ).toBe(true);
  });

  it('skips signed-order prebuild when the review has no approve txs', () => {
    expect(
      shouldSkipMarketSignedPrebuild({
        quoteResult: createQuoteResult({
          swapShouldSignedData: {
            unSignedInfo: {},
          } as never,
        }),
        approveUnsignedTxCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldSkipMarketSignedPrebuild({
        quoteResult: createQuoteResult({
          swapShouldSignedData: {
            unSignedInfo: {},
          } as never,
        }),
        approveUnsignedTxCount: 1,
      }),
    ).toBe(false);

    expect(
      shouldSkipMarketSignedPrebuild({
        quoteResult: createQuoteResult(),
        approveUnsignedTxCount: 0,
      }),
    ).toBe(false);
  });
});
