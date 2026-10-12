import BigNumber from 'bignumber.js';

import type {
  IDustSweepItem,
  IDustSweepItemStatus,
  IDustSweepReason,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';

export type IDustSweepState = {
  phase:
    | 'selecting'
    | 'running'
    | 'paused'
    | 'blocked'
    | 'leaving'
    | 'left'
    | 'completed';
  snapshot?: IDustSweepSnapshot;
  items: IDustSweepItem[];
};
export const initialDustSweepState: IDustSweepState = {
  phase: 'selecting',
  items: [],
};
type IDustSweepAction =
  | {
      type: 'start';
      snapshot: IDustSweepSnapshot;
      unavailable?: Record<string, IDustSweepReason>;
    }
  | {
      type:
        | 'pause'
        | 'paused'
        | 'resume'
        | 'reset'
        | 'leave'
        | 'left'
        | 'leaveBlocked';
    }
  | {
      type: 'approvalBroadcast';
      sessionId: string;
      key: string;
      approvalTxIds: string[];
    }
  | {
      type: 'item';
      sessionId: string;
      key: string;
      status: IDustSweepItemStatus;
      approvalTxIds?: string[];
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
      if (
        state.phase !== 'selecting' ||
        !action.snapshot.tokens.some(
          (token) => !action.unavailable?.[token.key],
        )
      )
        return state;
      return {
        phase: 'running',
        snapshot: action.snapshot,
        items: action.snapshot.tokens.map((token) =>
          action.unavailable?.[token.key]
            ? {
                token,
                status: 'skipped',
                reason: action.unavailable[token.key],
              }
            : { token, status: 'waiting' },
        ),
      };
    case 'pause':
      return state.phase === 'running' ? { ...state, phase: 'paused' } : state;
    case 'paused':
      return state.phase === 'running' ? { ...state, phase: 'paused' } : state;
    case 'resume':
      return state.phase === 'paused' &&
        state.items.every((item) => item.status !== 'unknown')
        ? { ...state, phase: 'running' }
        : state;
    case 'reset':
      return state.phase === 'completed' || state.phase === 'selecting'
        ? initialDustSweepState
        : state;
    case 'leave':
      return state.phase !== 'left' ? { ...state, phase: 'leaving' } : state;
    case 'leaveBlocked':
      return state.phase === 'leaving' &&
        state.items.some((item) => item.status === 'unknown')
        ? { ...state, phase: 'blocked' }
        : state;
    case 'left':
      return state.phase === 'leaving' ? { ...state, phase: 'left' } : state;
    case 'approvalBroadcast': {
      if (state.snapshot?.id !== action.sessionId) return state;
      const current = state.items.find((item) => item.token.key === action.key);
      if (!current || current.status !== 'signing') return state;
      return {
        ...state,
        items: state.items.map((item) =>
          item === current
            ? { ...item, approvalTxIds: action.approvalTxIds }
            : item,
        ),
      };
    }
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
              approvalTxIds: action.approvalTxIds ?? item.approvalTxIds,
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
      let phase = state.phase;
      if (phase !== 'leaving' && phase !== 'left') {
        if (items.some((item) => item.status === 'unknown')) phase = 'blocked';
        else if (items.every(isDustSweepItemTerminal)) phase = 'completed';
      }
      return { ...state, items, phase };
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
    skippedCount: items.filter((item) => item.status === 'skipped').length,
    failedCount: items.filter((item) => item.status === 'failed').length,
    settledCount: items.filter(isDustSweepItemTerminal).length,
    receivedAmount: success
      .reduce(
        (sum, item) => sum.plus(item.receivedAmount ?? '0'),
        new BigNumber(0),
      )
      .toFixed(),
  };
}

export function getDustSweepPresentation(state: IDustSweepState) {
  const totals = getDustSweepTotals(state.items);
  const active = state.items.find((item) =>
    ['preparing', 'signing', 'broadcasted', 'unknown'].includes(item.status),
  );
  const completed = state.phase === 'completed';
  const unknown =
    state.phase === 'blocked' ||
    state.items.some((item) => item.status === 'unknown');
  const progress =
    completed || state.phase === 'paused' || unknown
      ? totals.settledCount
      : Math.min(totals.settledCount + 1, state.items.length);
  let outcome: 'pending' | 'failed' | 'partial' | 'success' = 'success';
  if (unknown) outcome = 'pending';
  else if (!totals.successCount) outcome = 'failed';
  else if (totals.failedCount || totals.skippedCount) outcome = 'partial';
  return { totals, active, completed, unknown, progress, outcome } as const;
}
