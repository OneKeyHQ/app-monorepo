import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
  isMarketReviewUserCancelledError,
  normalizeMarketReviewInternalError,
  publishMarketExecutionResultBestEffort,
  requireMarketReviewExecutionSnapshot,
  runMarketPostExecutionActionBestEffort,
  settleMarketExecutionWithBestEffortHistory,
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
  describe('settleMarketExecutionWithBestEffortHistory', () => {
    it.each([
      ['swap', { txHash: '0xswap' }],
      ['wrap', { txHash: '0xwrap' }],
      ['signed order', { orderId: 'order-1' }],
    ])(
      'keeps a successful %s execution successful when history persistence fails',
      async (_path, executionResult) => {
        const calls: string[] = [];
        const executeIrreversibleAction = jest.fn(async () => {
          calls.push('execute');
          return executionResult;
        });
        const onBroadcast = jest.fn(() => {
          calls.push('broadcast');
        });
        const onBroadcastError = jest.fn();
        const persistHistory = jest.fn(async () => {
          calls.push('history');
          throw new OneKeyLocalError('storage unavailable');
        });
        const onHistoryError = jest.fn(() => {
          calls.push('history-error');
        });

        const result = await executeIrreversibleAction();

        await expect(
          settleMarketExecutionWithBestEffortHistory({
            result,
            onBroadcast,
            onBroadcastError,
            persistHistory,
            onHistoryError,
          }),
        ).resolves.toBeUndefined();

        expect(executeIrreversibleAction).toHaveBeenCalledTimes(1);
        expect(onBroadcast).toHaveBeenCalledTimes(1);
        expect(onBroadcast).toHaveBeenCalledWith(executionResult);
        expect(onBroadcastError).not.toHaveBeenCalled();
        expect(persistHistory).toHaveBeenCalledTimes(1);
        expect(onHistoryError).toHaveBeenCalledTimes(1);
        expect(calls).toEqual([
          'execute',
          'broadcast',
          'history',
          'history-error',
        ]);
      },
    );

    it('does not expose an already-broadcast execution as retryable when the UI callback throws', async () => {
      const onBroadcast = jest.fn(() => {
        throw new OneKeyLocalError('state update failed');
      });
      const onBroadcastError = jest.fn();
      const persistHistory = jest.fn(async () => {});

      await expect(
        settleMarketExecutionWithBestEffortHistory({
          result: { txHash: '0xswap' },
          onBroadcast,
          onBroadcastError,
          persistHistory,
          onHistoryError: jest.fn(),
        }),
      ).resolves.toBeUndefined();

      expect(onBroadcast).toHaveBeenCalledTimes(1);
      expect(onBroadcastError).toHaveBeenCalledTimes(1);
      expect(persistHistory).toHaveBeenCalledTimes(1);
    });

    it('stays successful even when best-effort error reporters throw', async () => {
      const onBroadcast = jest.fn(() => {
        throw new OneKeyLocalError('state update failed');
      });
      const persistHistory = jest.fn(async () => {
        throw new OneKeyLocalError('storage unavailable');
      });

      await expect(
        settleMarketExecutionWithBestEffortHistory({
          result: { txHash: '0xswap' },
          onBroadcast,
          onBroadcastError: () => {
            throw new OneKeyLocalError('publish logging failed');
          },
          persistHistory,
          onHistoryError: () => {
            throw new OneKeyLocalError('history logging failed');
          },
        }),
      ).resolves.toBeUndefined();

      expect(onBroadcast).toHaveBeenCalledTimes(1);
      expect(persistHistory).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps an already-broadcast approval successful when its UI callback throws', () => {
    const onBroadcast = jest.fn(() => {
      throw new OneKeyLocalError('state update failed');
    });
    const onBroadcastError = jest.fn();

    expect(() =>
      publishMarketExecutionResultBestEffort({
        result: { txHash: '0xapprove', amount: '1' },
        onBroadcast,
        onBroadcastError,
      }),
    ).not.toThrow();

    expect(onBroadcast).toHaveBeenCalledTimes(1);
    expect(onBroadcastError).toHaveBeenCalledTimes(1);
  });

  it('keeps post-broadcast state settlement from escaping into the send catch', () => {
    const action = jest.fn(() => {
      throw new OneKeyLocalError('atom update failed');
    });
    const onError = jest.fn(() => {
      throw new OneKeyLocalError('logging failed');
    });

    expect(() =>
      runMarketPostExecutionActionBestEffort({ action, onError }),
    ).not.toThrow();

    expect(action).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  describe('Market review error classification', () => {
    it.each([
      [{ key: 'global.cancel' }],
      [{ code: 803 }],
      [{ code: 822 }],
      [{ code: 4001 }],
      [new Error('User rejected the request')],
      [new Error('Request rejected by user')],
      [new Error('User cancelled signing')],
      [new Error('Action cancelled by user')],
    ])('recognizes an explicit user cancellation %#', (error) => {
      expect(isMarketReviewUserCancelledError(error)).toBe(true);
    });

    it('does not swallow ordinary local failures that use the default error code', () => {
      expect(
        isMarketReviewUserCancelledError(
          new OneKeyLocalError('Market sign build failed.'),
        ),
      ).toBe(false);
      expect(
        isMarketReviewUserCancelledError({
          code: -99_999,
          message: 'Unknown OneKey internal error',
        }),
      ).toBe(false);
    });

    it('localizes only internal Market diagnostics and preserves the cause', () => {
      const cause = new OneKeyLocalError('Market review snapshot missing.');
      const localized = normalizeMarketReviewInternalError({
        error: cause,
        fallbackMessage: 'Swap failed',
      });
      const serverError = new Error('Provider temporarily unavailable');

      expect(localized).toBeInstanceOf(OneKeyLocalError);
      expect((localized as Error).message).toBe('Swap failed');
      expect((localized as Error).cause).toBe(cause);
      expect(
        normalizeMarketReviewInternalError({
          error: serverError,
          fallbackMessage: 'Swap failed',
        }),
      ).toBe(serverError);
    });
  });

  describe('requireMarketReviewExecutionSnapshot', () => {
    const snapshot = {
      kind: 'swap' as const,
      accountAddress: '0xAbCd',
      accountId: 'account-1',
      networkId: 'evm--1',
    };

    it('accepts the same live EVM signer and ignores address casing', () => {
      expect(
        requireMarketReviewExecutionSnapshot({
          snapshot,
          expectedKind: 'swap',
          currentSigner: {
            accountAddress: '0xaBcD',
            accountId: 'account-1',
            networkId: 'evm--1',
          },
        }),
      ).toBe(snapshot);
    });

    it.each([
      ['account', { accountId: 'account-2' }],
      ['network', { networkId: 'evm--137' }],
      ['address', { accountAddress: '0xother' }],
    ])('rejects a changed live %s before execution', (_label, changed) => {
      expect(() =>
        requireMarketReviewExecutionSnapshot({
          snapshot,
          expectedKind: 'swap',
          currentSigner: {
            accountAddress: '0xAbCd',
            accountId: 'account-1',
            networkId: 'evm--1',
            ...changed,
          },
        }),
      ).toThrow('Market signing account changed');
    });

    it('rejects missing and wrong-kind snapshots', () => {
      expect(() =>
        requireMarketReviewExecutionSnapshot({
          expectedKind: 'swap',
          currentSigner: snapshot,
        }),
      ).toThrow('Market review snapshot missing');
      expect(() =>
        requireMarketReviewExecutionSnapshot({
          snapshot,
          expectedKind: 'wrap',
          currentSigner: snapshot,
        }),
      ).toThrow('Market review snapshot type mismatch');
    });
  });

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
