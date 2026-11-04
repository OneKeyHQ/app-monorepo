import BigNumber from 'bignumber.js';

import { EDustSweepItemStatus } from '@onekeyhq/shared/types/swap/dustSweep';
import type {
  IDustSweepItem,
  IDustSweepItemStatus,
  IDustSweepReason,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapErrorMessage } from '@onekeyhq/shared/types/swap/types';

export enum EDustSweepPhase {
  Selecting = 'selecting',
  Running = 'running',
  Paused = 'paused',
  Blocked = 'blocked',
  Leaving = 'leaving',
  Left = 'left',
  Completed = 'completed',
}

export type IDustSweepState = {
  phase: `${EDustSweepPhase}`;
  snapshot?: IDustSweepSnapshot;
  items: IDustSweepItem[];
};
export const initialDustSweepState: IDustSweepState = {
  phase: EDustSweepPhase.Selecting,
  items: [],
};
type IDustSweepAction =
  | {
      type: 'start';
      snapshot: IDustSweepSnapshot;
    }
  | {
      type:
        | 'pause'
        | 'resume'
        | 'stop'
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
      type: 'submissionError';
      sessionId: string;
      key: string;
      message?: string;
      localError?: ISwapErrorMessage;
      txId?: string;
      approvalTxIds?: string[];
    }
  | ({
      sessionId: string;
      key: string;
      approvalTxIds?: string[];
      txId?: string;
      receivedAmount?: string;
      receivedAmountEstimated?: boolean;
      receiptUnavailable?: boolean;
      reason?: IDustSweepReason;
      message?: string;
      submissionErrorMessage?: string;
      providerErrorMessage?: string;
      localError?: ISwapErrorMessage;
    } & (
      | { type: 'item'; status: IDustSweepItemStatus }
      | { type: 'itemError' }
    ));

export function isDustSweepItemTerminal(item: IDustSweepItem) {
  return (
    item.status === EDustSweepItemStatus.Success ||
    item.status === EDustSweepItemStatus.Skipped ||
    item.status === EDustSweepItemStatus.Failed
  );
}

export function isDustSweepItemActive(item: IDustSweepItem) {
  return [
    EDustSweepItemStatus.Preparing,
    EDustSweepItemStatus.Building,
    EDustSweepItemStatus.Signing,
    EDustSweepItemStatus.Broadcasted,
    EDustSweepItemStatus.Unknown,
  ].some((status) => status === item.status);
}

const transitions: Record<
  IDustSweepItemStatus,
  readonly IDustSweepItemStatus[]
> = {
  [EDustSweepItemStatus.Waiting]: [
    EDustSweepItemStatus.Preparing,
    EDustSweepItemStatus.Building,
  ],
  [EDustSweepItemStatus.Preparing]: [
    EDustSweepItemStatus.Waiting,
    EDustSweepItemStatus.Building,
    EDustSweepItemStatus.Skipped,
  ],
  [EDustSweepItemStatus.Building]: [
    EDustSweepItemStatus.Waiting,
    EDustSweepItemStatus.Signing,
    EDustSweepItemStatus.Failed,
  ],
  [EDustSweepItemStatus.Signing]: [
    EDustSweepItemStatus.Building,
    EDustSweepItemStatus.Broadcasted,
    EDustSweepItemStatus.Failed,
    EDustSweepItemStatus.Unknown,
  ],
  [EDustSweepItemStatus.Broadcasted]: [
    EDustSweepItemStatus.Success,
    EDustSweepItemStatus.Failed,
  ],
  [EDustSweepItemStatus.Unknown]: [EDustSweepItemStatus.Broadcasted],
  [EDustSweepItemStatus.Success]: [],
  [EDustSweepItemStatus.Skipped]: [],
  [EDustSweepItemStatus.Failed]: [],
};

export function dustSweepReducer(
  state: IDustSweepState,
  action: IDustSweepAction,
): IDustSweepState {
  if (state.phase === EDustSweepPhase.Left) return state;
  switch (action.type) {
    // Every selected token is submitted and quoted on its own turn.
    case 'start':
      if (
        state.phase !== EDustSweepPhase.Selecting ||
        !action.snapshot.tokens.length
      )
        return state;
      return {
        phase: EDustSweepPhase.Running,
        snapshot: action.snapshot,
        items: action.snapshot.tokens.map((token) => ({
          token,
          status: EDustSweepItemStatus.Waiting,
        })),
      };
    case 'pause':
      return state.phase === EDustSweepPhase.Running
        ? { ...state, phase: EDustSweepPhase.Paused }
        : state;
    case 'resume':
      return state.phase === EDustSweepPhase.Paused
        ? { ...state, phase: EDustSweepPhase.Running }
        : state;
    // Stop gives up the remaining tokens and goes back to selection.
    case 'stop':
      return state.phase === EDustSweepPhase.Paused &&
        !state.items.some(isDustSweepItemActive)
        ? initialDustSweepState
        : state;
    case 'reset':
      return state.phase === EDustSweepPhase.Completed ||
        state.phase === EDustSweepPhase.Selecting
        ? initialDustSweepState
        : state;
    case 'leave':
      return { ...state, phase: EDustSweepPhase.Leaving };
    case 'leaveBlocked':
      return state.phase === EDustSweepPhase.Leaving &&
        state.items.some((item) => item.status === EDustSweepItemStatus.Unknown)
        ? { ...state, phase: EDustSweepPhase.Blocked }
        : state;
    case 'left':
      return state.phase === EDustSweepPhase.Leaving
        ? { ...state, phase: EDustSweepPhase.Left }
        : state;
    case 'approvalBroadcast': {
      if (state.snapshot?.id !== action.sessionId) return state;
      const current = state.items.find((item) => item.token.key === action.key);
      if (!current || current.status !== EDustSweepItemStatus.Signing)
        return state;
      return {
        ...state,
        items: state.items.map((item) =>
          item === current
            ? { ...item, approvalTxIds: action.approvalTxIds }
            : item,
        ),
      };
    }
    case 'submissionError': {
      if (state.snapshot?.id !== action.sessionId) return state;
      return {
        ...state,
        items: state.items.map((item) =>
          item.token.key === action.key && !isDustSweepItemTerminal(item)
            ? {
                ...item,
                submissionErrorMessage: action.message,
                localError: action.localError,
                txId: action.txId ?? item.txId,
                approvalTxIds: action.approvalTxIds ?? item.approvalTxIds,
              }
            : item,
        ),
      };
    }
    case 'itemError':
    case 'item': {
      if (state.snapshot?.id !== action.sessionId) return state;
      const current = state.items.find((item) => item.token.key === action.key);
      if (!current) return state;
      let status: IDustSweepItemStatus;
      if (action.type === 'item') status = action.status;
      else if (current.status === EDustSweepItemStatus.Preparing)
        status = EDustSweepItemStatus.Skipped;
      else status = EDustSweepItemStatus.Failed;
      if (!transitions[current.status].includes(status)) return state;
      if (
        current.status === EDustSweepItemStatus.Waiting &&
        (state.phase !== EDustSweepPhase.Running ||
          state.items.some(isDustSweepItemActive) ||
          (status === EDustSweepItemStatus.Building &&
            !current.approvalTxIds?.length))
      )
        return state;
      // A confirmed swap may settle before its received amount is available.
      if (
        status === EDustSweepItemStatus.Success &&
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
              status,
              approvalTxIds: action.approvalTxIds ?? item.approvalTxIds,
              txId: action.txId ?? item.txId,
              receivedAmount: action.receiptUnavailable
                ? undefined
                : action.receivedAmount,
              receivedAmountEstimated:
                status === EDustSweepItemStatus.Success &&
                !action.receiptUnavailable
                  ? action.receivedAmountEstimated
                  : undefined,
              receiptUnavailable: action.receiptUnavailable,
              reason: action.reason,
              message: action.message,
              submissionErrorMessage: action.submissionErrorMessage,
              providerErrorMessage: action.providerErrorMessage,
              localError: action.localError,
            }
          : item,
      );
      let phase = state.phase;
      if (phase !== EDustSweepPhase.Leaving) {
        if (items.some((item) => item.status === EDustSweepItemStatus.Unknown))
          phase = EDustSweepPhase.Blocked;
        else if (items.every(isDustSweepItemTerminal))
          phase = EDustSweepPhase.Completed;
      }
      return { ...state, items, phase };
    }
    default:
      return state;
  }
}

// Skipped or failed: what the result calls "not converted".
export function isDustSweepItemNotConverted(item: IDustSweepItem) {
  return (
    item.status === EDustSweepItemStatus.Skipped ||
    item.status === EDustSweepItemStatus.Failed
  );
}

export function getDustSweepTotals(items: IDustSweepItem[]) {
  const success = items.filter(
    (item) => item.status === EDustSweepItemStatus.Success,
  );
  return {
    receiptUnavailable: success.some((item) => item.receiptUnavailable),
    receivedAmountEstimated: success.some(
      (item) => item.receivedAmountEstimated,
    ),
    successCount: success.length,
    skippedCount: items.filter(
      (item) => item.status === EDustSweepItemStatus.Skipped,
    ).length,
    failedCount: items.filter(
      (item) => item.status === EDustSweepItemStatus.Failed,
    ).length,
    notConvertedCount: items.filter(isDustSweepItemNotConverted).length,
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
  const active = state.items.find(isDustSweepItemActive);
  const completed = state.phase === EDustSweepPhase.Completed;
  const unknown =
    state.phase === EDustSweepPhase.Blocked ||
    state.items.some((item) => item.status === EDustSweepItemStatus.Unknown);
  const progress =
    completed || state.phase === EDustSweepPhase.Paused || unknown
      ? totals.settledCount
      : Math.min(totals.settledCount + 1, state.items.length);
  let outcome: 'pending' | 'failed' | 'partial' | 'success' = 'success';
  if (unknown) outcome = 'pending';
  else if (!totals.successCount) outcome = 'failed';
  else if (totals.failedCount || totals.skippedCount) outcome = 'partial';
  return { totals, active, completed, unknown, progress, outcome } as const;
}
