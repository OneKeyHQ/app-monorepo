import BigNumber from 'bignumber.js';

import type {
  IDustSweepItem,
  IDustSweepItemStatus,
  IDustSweepReason,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';

export type IDustSweepState = {
  phase: 'selecting' | 'running' | 'pausing' | 'paused' | 'completed';
  snapshot?: IDustSweepSnapshot;
  items: IDustSweepItem[];
};
export const initialDustSweepState: IDustSweepState = {
  phase: 'selecting',
  items: [],
};
type IDustSweepAction =
  | { type: 'start'; snapshot: IDustSweepSnapshot }
  | { type: 'pause' | 'paused' | 'resume' | 'reset' }
  | {
      type: 'item';
      sessionId: string;
      key: string;
      status: IDustSweepItemStatus;
      txId?: string;
      receivedAmount?: string;
      receiptUnavailable?: boolean;
      reason?: IDustSweepReason;
      message?: string;
    };

export function isDustSweepItemTerminal(item: IDustSweepItem) {
  return ['success', 'skipped', 'failed'].includes(item.status);
}

const transitions: Record<IDustSweepItemStatus, IDustSweepItemStatus[]> = {
  waiting: ['preparing'],
  preparing: ['waiting', 'signing', 'skipped'],
  signing: ['preparing', 'broadcasted', 'skipped', 'unknown'],
  broadcasted: ['success', 'failed'],
  unknown: ['broadcasted'],
  success: [],
  skipped: [],
  failed: [],
};

export function dustSweepReducer(
  state: IDustSweepState,
  action: IDustSweepAction,
): IDustSweepState {
  switch (action.type) {
    case 'start':
      if (state.phase !== 'selecting' || !action.snapshot.tokens.length)
        return state;
      return {
        phase: 'running',
        snapshot: action.snapshot,
        items: action.snapshot.tokens.map((token) => ({
          token,
          status: 'waiting',
        })),
      };
    case 'pause':
      return state.phase === 'running' ? { ...state, phase: 'pausing' } : state;
    case 'paused':
      return state.phase === 'pausing' || state.phase === 'running'
        ? { ...state, phase: 'paused' }
        : state;
    case 'resume':
      return state.phase === 'paused' &&
        state.items.every((item) => item.status !== 'unknown')
        ? { ...state, phase: 'running' }
        : state;
    case 'reset':
      return state.phase === 'completed' || state.phase === 'selecting'
        ? initialDustSweepState
        : state;
    case 'item': {
      if (state.snapshot?.id !== action.sessionId) return state;
      const current = state.items.find((item) => item.token.key === action.key);
      if (!current || !transitions[current.status].includes(action.status))
        return state;
      // A confirmed swap may settle before its received amount is available.
      if (
        action.status === 'success' &&
        (!current.txId ||
          (!action.receiptUnavailable &&
            (!new BigNumber(action.receivedAmount ?? '').isFinite() ||
              new BigNumber(action.receivedAmount ?? '').isNegative())))
      )
        return state;
      const items = state.items.map((item) =>
        item === current
          ? {
              ...item,
              status: action.status,
              txId: action.txId ?? item.txId,
              receivedAmount: action.receiptUnavailable
                ? undefined
                : action.receivedAmount,
              receiptUnavailable: action.receiptUnavailable,
              reason: action.reason,
              message: action.message,
            }
          : item,
      );
      return {
        ...state,
        items,
        phase: items.every(isDustSweepItemTerminal) ? 'completed' : state.phase,
      };
    }
    default:
      return state;
  }
}

export function getDustSweepTotals(items: IDustSweepItem[]) {
  const success = items.filter((item) => item.status === 'success');
  return {
    receiptUnavailable: success.some((item) => item.receiptUnavailable),
    successCount: success.length,
    skippedCount: items.filter((item) =>
      ['skipped', 'failed'].includes(item.status),
    ).length,
    settledCount: items.filter(isDustSweepItemTerminal).length,
    receivedAmount: success
      .reduce(
        (sum, item) => sum.plus(item.receivedAmount ?? '0'),
        new BigNumber(0),
      )
      .toFixed(),
  };
}
