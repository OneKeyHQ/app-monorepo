import type { ISwapStep } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapStepStatus,
  ESwapStepType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { reconcileSwapStepWithHistory } from './swapStepHistory';

describe('reconcileSwapStepWithHistory', () => {
  const orderStep = {
    type: ESwapStepType.SIGN_MESSAGE,
    status: ESwapStepStatus.PENDING,
    orderId: 'fusion-order-id',
  } as ISwapStep;

  it('copies the eventual fill transaction id into an order-based step', () => {
    expect(
      reconcileSwapStepWithHistory({
        step: orderStep,
        historyStatus: ESwapTxHistoryStatus.SUCCESS,
        txId: 'fill-transaction-id',
      }),
    ).toMatchObject({
      status: ESwapStepStatus.SUCCESS,
      orderId: 'fusion-order-id',
      txHash: 'fill-transaction-id',
    });
  });

  it('copies a fill transaction id while the order is still pending', () => {
    expect(
      reconcileSwapStepWithHistory({
        step: orderStep,
        historyStatus: ESwapTxHistoryStatus.PENDING,
        txId: 'pending-fill-transaction-id',
      }),
    ).toMatchObject({
      status: ESwapStepStatus.PENDING,
      orderId: 'fusion-order-id',
      txHash: 'pending-fill-transaction-id',
    });
  });

  it('preserves an existing transaction id when history has none', () => {
    expect(
      reconcileSwapStepWithHistory({
        step: { ...orderStep, txHash: 'existing-transaction-id' },
        historyStatus: ESwapTxHistoryStatus.FAILED,
      }).txHash,
    ).toBe('existing-transaction-id');
  });
});
