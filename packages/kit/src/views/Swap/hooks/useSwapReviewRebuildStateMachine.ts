import { useCallback, useEffect, useRef, useState } from 'react';

import {
  initialSwapReviewRebuildState,
  reduceSwapReviewRebuildState,
} from '../utils/swapReviewRebuildStateMachine';

import type {
  ESwapReviewRebuildPhase,
  ISwapReviewRebuildState,
  ISwapReviewRebuildStateEvent,
} from '../utils/swapReviewRebuildStateMachine';

export type ISwapReviewRebuildOperation = {
  requestId: number;
  isCurrent: () => boolean;
  advance: (
    phase:
      | ESwapReviewRebuildPhase.BuildingTransaction
      | ESwapReviewRebuildPhase.PreparingExecution
      | ESwapReviewRebuildPhase.EstimatingFee,
  ) => void;
  resolve: () => void;
  reject: () => void;
};

export function useSwapReviewRebuildStateMachine() {
  const [state, setState] = useState<ISwapReviewRebuildState>(
    initialSwapReviewRebuildState,
  );
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);

  const dispatch = useCallback((event: ISwapReviewRebuildStateEvent) => {
    const nextState = reduceSwapReviewRebuildState(stateRef.current, event);
    if (nextState !== stateRef.current) {
      stateRef.current = nextState;
      setState(nextState);
    }
  }, []);

  const begin = useCallback(
    (slippagePercentage: number): ISwapReviewRebuildOperation => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      dispatch({
        type: 'start',
        requestId,
        slippagePercentage,
      });

      const isCurrent = () => requestIdRef.current === requestId;

      return {
        requestId,
        isCurrent,
        advance: (phase) => {
          if (!isCurrent()) {
            return;
          }
          dispatch({ type: 'advance', requestId, phase });
        },
        resolve: () => {
          if (!isCurrent()) {
            return;
          }
          dispatch({ type: 'resolve', requestId });
        },
        reject: () => {
          if (!isCurrent()) {
            return;
          }
          dispatch({ type: 'reject', requestId });
        },
      };
    },
    [dispatch],
  );

  const resetUncommittedError = useCallback(() => {
    dispatch({
      type: 'resetUncommittedError',
      requestId: requestIdRef.current,
    });
  }, [dispatch]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  return {
    state,
    stateRef,
    begin,
    resetUncommittedError,
  };
}
