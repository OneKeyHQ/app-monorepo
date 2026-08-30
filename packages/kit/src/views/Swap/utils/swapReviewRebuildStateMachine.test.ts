import {
  ESwapReviewRebuildPhase,
  initialSwapReviewRebuildState,
  isSwapReviewConfirmBlocked,
  isSwapReviewExecutionRebuildPending,
  reduceSwapReviewRebuildState,
} from './swapReviewRebuildStateMachine';

describe('swapReviewRebuildStateMachine', () => {
  it('advances through execution and fee phases before becoming ready', () => {
    const validating = reduceSwapReviewRebuildState(
      initialSwapReviewRebuildState,
      {
        type: 'start',
        requestId: 1,
        slippagePercentage: 2,
      },
    );
    const building = reduceSwapReviewRebuildState(validating, {
      type: 'advance',
      requestId: 1,
      phase: ESwapReviewRebuildPhase.BuildingTransaction,
    });
    const preparing = reduceSwapReviewRebuildState(building, {
      type: 'advance',
      requestId: 1,
      phase: ESwapReviewRebuildPhase.PreparingExecution,
    });
    const estimating = reduceSwapReviewRebuildState(preparing, {
      type: 'advance',
      requestId: 1,
      phase: ESwapReviewRebuildPhase.EstimatingFee,
    });
    const ready = reduceSwapReviewRebuildState(estimating, {
      type: 'resolve',
      requestId: 1,
    });

    expect(isSwapReviewExecutionRebuildPending(preparing.phase)).toBe(true);
    expect(estimating.executionReady).toBe(true);
    expect(isSwapReviewConfirmBlocked(estimating.phase)).toBe(true);
    expect(ready.phase).toBe(ESwapReviewRebuildPhase.Ready);
    expect(isSwapReviewConfirmBlocked(ready.phase)).toBe(false);
  });

  it('ignores stale requests and regressive phases', () => {
    const validating = reduceSwapReviewRebuildState(
      initialSwapReviewRebuildState,
      {
        type: 'start',
        requestId: 2,
        slippagePercentage: 3,
      },
    );
    const building = reduceSwapReviewRebuildState(validating, {
      type: 'advance',
      requestId: 2,
      phase: ESwapReviewRebuildPhase.BuildingTransaction,
    });
    const estimating = reduceSwapReviewRebuildState(building, {
      type: 'advance',
      requestId: 2,
      phase: ESwapReviewRebuildPhase.EstimatingFee,
    });

    expect(
      reduceSwapReviewRebuildState(building, {
        type: 'advance',
        requestId: 1,
        phase: ESwapReviewRebuildPhase.EstimatingFee,
      }),
    ).toBe(building);
    expect(
      reduceSwapReviewRebuildState(estimating, {
        type: 'advance',
        requestId: 2,
        phase: ESwapReviewRebuildPhase.BuildingTransaction,
      }),
    ).toBe(estimating);
  });

  it('only resets an error when no rebuilt execution was committed', () => {
    const validating = reduceSwapReviewRebuildState(
      initialSwapReviewRebuildState,
      {
        type: 'start',
        requestId: 1,
        slippagePercentage: 2,
      },
    );
    const validationError = reduceSwapReviewRebuildState(validating, {
      type: 'reject',
      requestId: 1,
    });
    const reset = reduceSwapReviewRebuildState(validationError, {
      type: 'resetUncommittedError',
      requestId: 1,
    });

    expect(reset.phase).toBe(ESwapReviewRebuildPhase.Idle);

    const estimating = reduceSwapReviewRebuildState(
      reduceSwapReviewRebuildState(
        reduceSwapReviewRebuildState(validating, {
          type: 'advance',
          requestId: 1,
          phase: ESwapReviewRebuildPhase.PreparingExecution,
        }),
        {
          type: 'advance',
          requestId: 1,
          phase: ESwapReviewRebuildPhase.EstimatingFee,
        },
      ),
      { type: 'reject', requestId: 1 },
    );

    expect(
      reduceSwapReviewRebuildState(estimating, {
        type: 'resetUncommittedError',
        requestId: 1,
      }),
    ).toBe(estimating);
  });
});
