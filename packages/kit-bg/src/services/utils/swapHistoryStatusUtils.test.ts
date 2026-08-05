import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import {
  mergeSwapOrderHash,
  shouldUpdateSwapHistoryAfterTxState,
} from './swapHistoryStatusUtils';

function createHistory({
  receiverTransactionId,
  swapOrderHash,
}: {
  receiverTransactionId?: string;
  swapOrderHash?: ISwapTxHistory['swapOrderHash'];
} = {}): ISwapTxHistory {
  return {
    status: ESwapTxHistoryStatus.PENDING,
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
});
