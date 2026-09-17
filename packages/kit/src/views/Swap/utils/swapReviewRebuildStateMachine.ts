export enum ESwapReviewRebuildPhase {
  Idle = 'idle',
  ValidatingBalance = 'validatingBalance',
  BuildingTransaction = 'buildingTransaction',
  PreparingExecution = 'preparingExecution',
  EstimatingFee = 'estimatingFee',
  Ready = 'ready',
  Error = 'error',
}

export type ISwapReviewRebuildState = {
  requestId: number;
  phase: ESwapReviewRebuildPhase;
  slippagePercentage?: number;
  executionReady: boolean;
  failedPhase?: ESwapReviewRebuildPhase;
};

export type ISwapReviewRebuildStateEvent =
  | {
      type: 'start';
      requestId: number;
      slippagePercentage: number;
    }
  | {
      type: 'advance';
      requestId: number;
      phase:
        | ESwapReviewRebuildPhase.BuildingTransaction
        | ESwapReviewRebuildPhase.PreparingExecution
        | ESwapReviewRebuildPhase.EstimatingFee;
    }
  | {
      type: 'resolve';
      requestId: number;
    }
  | {
      type: 'reject';
      requestId: number;
    }
  | {
      type: 'resetUncommittedError';
      requestId: number;
    };

export const initialSwapReviewRebuildState: ISwapReviewRebuildState = {
  requestId: 0,
  phase: ESwapReviewRebuildPhase.Idle,
  executionReady: false,
};

const activePhaseOrder = {
  [ESwapReviewRebuildPhase.ValidatingBalance]: 0,
  [ESwapReviewRebuildPhase.BuildingTransaction]: 1,
  [ESwapReviewRebuildPhase.PreparingExecution]: 2,
  [ESwapReviewRebuildPhase.EstimatingFee]: 3,
} as const;

function getActivePhaseOrder(phase: ESwapReviewRebuildPhase) {
  if (phase in activePhaseOrder) {
    return activePhaseOrder[phase as keyof typeof activePhaseOrder];
  }
  return undefined;
}

export function reduceSwapReviewRebuildState(
  state: ISwapReviewRebuildState,
  event: ISwapReviewRebuildStateEvent,
): ISwapReviewRebuildState {
  if (event.type === 'start') {
    if (event.requestId <= state.requestId) {
      return state;
    }
    return {
      requestId: event.requestId,
      phase: ESwapReviewRebuildPhase.ValidatingBalance,
      slippagePercentage: event.slippagePercentage,
      executionReady: false,
    };
  }

  if (event.requestId !== state.requestId) {
    return state;
  }

  if (event.type === 'advance') {
    const currentOrder = getActivePhaseOrder(state.phase);
    const nextOrder = getActivePhaseOrder(event.phase);
    if (
      currentOrder === undefined ||
      nextOrder === undefined ||
      nextOrder <= currentOrder
    ) {
      return state;
    }
    return {
      ...state,
      phase: event.phase,
      executionReady:
        state.executionReady ||
        event.phase === ESwapReviewRebuildPhase.EstimatingFee,
    };
  }

  if (event.type === 'resolve') {
    if (state.phase !== ESwapReviewRebuildPhase.EstimatingFee) {
      return state;
    }
    return {
      ...state,
      phase: ESwapReviewRebuildPhase.Ready,
      executionReady: true,
    };
  }

  if (event.type === 'reject') {
    if (getActivePhaseOrder(state.phase) === undefined) {
      return state;
    }
    return {
      ...state,
      failedPhase: state.phase,
      phase: ESwapReviewRebuildPhase.Error,
    };
  }

  if (
    event.type === 'resetUncommittedError' &&
    state.phase === ESwapReviewRebuildPhase.Error &&
    !state.executionReady
  ) {
    return {
      ...initialSwapReviewRebuildState,
      requestId: state.requestId,
    };
  }

  return state;
}

export function isSwapReviewRebuildInProgress(phase?: ESwapReviewRebuildPhase) {
  if (!phase) {
    return false;
  }
  return getActivePhaseOrder(phase) !== undefined;
}

export function isSwapReviewExecutionRebuildPending(
  phase?: ESwapReviewRebuildPhase,
) {
  return (
    phase === ESwapReviewRebuildPhase.ValidatingBalance ||
    phase === ESwapReviewRebuildPhase.BuildingTransaction ||
    phase === ESwapReviewRebuildPhase.PreparingExecution
  );
}

export function isSwapReviewConfirmBlocked(phase?: ESwapReviewRebuildPhase) {
  if (!phase) {
    return false;
  }
  return (
    phase !== ESwapReviewRebuildPhase.Idle &&
    phase !== ESwapReviewRebuildPhase.Ready
  );
}
