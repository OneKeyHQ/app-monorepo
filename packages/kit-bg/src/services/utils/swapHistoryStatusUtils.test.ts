import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  mergeSwapOrderHash,
  shouldEmitSwapHistoryBalanceUpdate,
  shouldShowSwapHistoryStatusToast,
  shouldUpdateSwapHistoryAfterTxState,
} from './swapHistoryStatusUtils';

function createHistory({
  receiverTransactionId,
  swapOrderHash,
  status = ESwapTxHistoryStatus.PENDING,
  crossChainStatus,
}: {
  receiverTransactionId?: string;
  swapOrderHash?: ISwapTxHistory['swapOrderHash'];
  status?: ESwapTxHistoryStatus;
  crossChainStatus?: ESwapCrossChainStatus;
} = {}): ISwapTxHistory {
  return {
    status,
    crossChainStatus,
    swapOrderHash,
    txInfo: {
      txId: '0xsource',
      receiverTransactionId,
    },
    baseInfo: {
      toAmount: '1',
    },
    swapInfo: {
      provider: {
        provider: 'SwapHifiSwap',
      },
    },
  } as ISwapTxHistory;
}

function createStatusResponse(
  overrides: Partial<IFetchSwapTxHistoryStatusResponse> = {},
): IFetchSwapTxHistoryStatusResponse {
  return {
    state: ESwapTxHistoryStatus.PENDING,
    ...overrides,
  };
}

describe('swapHistoryStatusUtils', () => {
  it('tracks a structured target hash without requiring a status change', () => {
    expect(
      shouldUpdateSwapHistoryAfterTxState({
        swapTxHistory: createHistory({
          swapOrderHash: { fromTxHash: '0xsource' },
        }),
        txStatusRes: createStatusResponse({
          swapOrderHash: {
            fromTxHash: '0xsource',
            toTxHash: '0xtarget',
          },
        }),
      }),
    ).toBe(true);
  });

  it('tracks a legacy receiver transaction hash without a status change', () => {
    expect(
      shouldUpdateSwapHistoryAfterTxState({
        swapTxHistory: createHistory(),
        txStatusRes: createStatusResponse({
          crossChainReceiveTxHash: '0xtarget',
        }),
      }),
    ).toBe(true);
  });

  it('does not treat omitted hash fields as removals', () => {
    expect(
      shouldUpdateSwapHistoryAfterTxState({
        swapTxHistory: createHistory({
          receiverTransactionId: '0xtarget',
          swapOrderHash: {
            fromTxHash: '0xsource',
            toTxHash: '0xtarget',
          },
        }),
        txStatusRes: createStatusResponse(),
      }),
    ).toBe(false);
  });

  it('merges a partial response without clearing existing hashes', () => {
    expect(
      mergeSwapOrderHash(
        {
          fromTxHash: '0xsource',
          bridgeHash: '0xbridge',
          toTxHash: '0xtarget',
        },
        { refundHash: '0xrefund' },
      ),
    ).toEqual({
      fromTxHash: '0xsource',
      bridgeHash: '0xbridge',
      toTxHash: '0xtarget',
      refundHash: '0xrefund',
    });
  });

  it('does not emit a balance update when only hashes change', () => {
    const history = createHistory({
      crossChainStatus: ESwapCrossChainStatus.FROM_SUCCESS,
    });
    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        previousSwapTxHistory: history,
        swapTxHistory: {
          ...history,
          swapOrderHash: { fromTxHash: '0xsource' },
        },
        txStatusRes: createStatusResponse({
          crossChainStatus: ESwapCrossChainStatus.FROM_SUCCESS,
          swapOrderHash: { fromTxHash: '0xsource' },
        }),
      }),
    ).toBe(false);
  });

  it('does not show a status toast when only hashes change', () => {
    const previousSwapTxHistory = createHistory({
      status: ESwapTxHistoryStatus.CANCELING,
    });
    expect(
      shouldShowSwapHistoryStatusToast({
        previousSwapTxHistory,
        swapTxHistory: {
          ...previousSwapTxHistory,
          swapOrderHash: { fromTxHash: '0xsource' },
        },
        shouldShowToast: true,
      }),
    ).toBe(false);
  });

  it('allows a status toast when the status changes', () => {
    const previousSwapTxHistory = createHistory();
    expect(
      shouldShowSwapHistoryStatusToast({
        previousSwapTxHistory,
        swapTxHistory: {
          ...previousSwapTxHistory,
          status: ESwapTxHistoryStatus.SUCCESS,
        },
        shouldShowToast: true,
      }),
    ).toBe(true);
  });

  it('emits a balance update when cross-chain status reaches a refresh state', () => {
    const previousSwapTxHistory = createHistory();
    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        previousSwapTxHistory,
        swapTxHistory: {
          ...previousSwapTxHistory,
          crossChainStatus: ESwapCrossChainStatus.FROM_SUCCESS,
        },
        txStatusRes: createStatusResponse({
          crossChainStatus: ESwapCrossChainStatus.FROM_SUCCESS,
        }),
      }),
    ).toBe(true);
  });

  it.each([
    ESwapTxHistoryStatus.SUCCESS,
    ESwapTxHistoryStatus.PARTIALLY_FILLED,
  ])(
    'emits a terminal %s update after cross-chain status was already refreshed',
    (status) => {
      const previousSwapTxHistory = createHistory({
        crossChainStatus: ESwapCrossChainStatus.TO_SUCCESS,
      });
      expect(
        shouldEmitSwapHistoryBalanceUpdate({
          previousSwapTxHistory,
          swapTxHistory: {
            ...previousSwapTxHistory,
            status,
          },
          txStatusRes: createStatusResponse({
            state: status,
            crossChainStatus: ESwapCrossChainStatus.TO_SUCCESS,
          }),
        }),
      ).toBe(true);
    },
  );

  it('emits a balance update when a successful response is normalized to canceled', () => {
    const previousSwapTxHistory = createHistory({
      status: ESwapTxHistoryStatus.CANCELING,
    });
    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        previousSwapTxHistory,
        swapTxHistory: {
          ...previousSwapTxHistory,
          status: ESwapTxHistoryStatus.CANCELED,
        },
        txStatusRes: createStatusResponse({
          state: ESwapTxHistoryStatus.SUCCESS,
        }),
      }),
    ).toBe(true);
  });
});
