/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IDialogInstance } from '@onekeyhq/components';
import type { ISwapQuoteSessionState } from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteSessionV2';
import {
  ESwapStockMarketQuoteGateStatus,
  type ISwapStockMarketQuoteGate,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/stockMarketQuoteGate';
import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { resolveSwapReviewExecutionGuardState } from '../../utils/swapExecutionSnapshotGuard';

import { useSwapReviewDialogLifecycle } from './useSwapReviewDialogLifecycle';

import type { ISwapExecutionSnapshot } from '../../utils/swapReviewState';

type IReviewDialogHandlers = {
  onClose: () => void;
  onDone: () => void;
};

function createDialog({
  forwardOnCloseAfterMs,
}: {
  forwardOnCloseAfterMs?: number;
} = {}) {
  let handlers: IReviewDialogHandlers | undefined;
  const close = jest.fn(async () => {
    if (forwardOnCloseAfterMs !== undefined) {
      setTimeout(() => handlers?.onClose(), forwardOnCloseAfterMs);
    }
  });
  const instance: IDialogInstance = {
    close,
    getForm: () => undefined,
    isExist: () => true,
  };
  const show = jest.fn((nextHandlers: IReviewDialogHandlers) => {
    handlers = nextHandlers;
    return instance;
  });
  return {
    close,
    getHandlers: () => handlers,
    show,
  };
}

function setupReviewLifecycle({
  initialReviewRevision,
  initialReviewValid = true,
}: {
  initialReviewRevision?: string;
  initialReviewValid?: boolean;
}) {
  const liveReview = {
    revision: initialReviewRevision,
    valid: initialReviewValid,
  };
  const onSettleReview = jest.fn();
  const onClearCurrentReview = jest.fn((reviewRevision: string) => {
    if (liveReview.revision === reviewRevision) {
      liveReview.revision = undefined;
    }
  });
  const onAbortEstimateFee = jest.fn();
  const onClearReviewSteps = jest.fn();
  const rendered = renderHook(
    ({ reviewRevision, reviewValid }) => {
      liveReview.revision = reviewRevision;
      liveReview.valid = reviewValid;
      return useSwapReviewDialogLifecycle({
        currentReviewRevision: reviewRevision,
        isCurrentReviewValid: reviewValid,
        getCurrentReviewRevision: () => liveReview.revision,
        isReviewRevisionCurrent: (candidateRevision) =>
          liveReview.revision === candidateRevision && liveReview.valid,
        onSettleReview,
        onClearCurrentReview,
        onAbortEstimateFee,
        onClearReviewSteps,
      });
    },
    {
      initialProps: {
        reviewRevision: initialReviewRevision,
        reviewValid: initialReviewValid,
      },
    },
  );

  const updateReview = (reviewRevision?: string, reviewValid = true) => {
    liveReview.revision = reviewRevision;
    liveReview.valid = reviewValid;
    rendered.rerender({ reviewRevision, reviewValid });
  };

  return {
    ...rendered,
    liveReview,
    onAbortEstimateFee,
    onClearCurrentReview,
    onClearReviewSteps,
    onSettleReview,
    updateReview,
  };
}

describe('useSwapReviewDialogLifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows only R2 when R2 supersedes R1 before the delayed show', () => {
    const lifecycle = setupReviewLifecycle({ initialReviewRevision: 'R1' });
    const r1Dialog = createDialog();
    const r2Dialog = createDialog();

    act(() => {
      lifecycle.result.current.scheduleReview('R1', r1Dialog.show);
      lifecycle.updateReview('R2');
      lifecycle.result.current.scheduleReview('R2', r2Dialog.show);
      jest.advanceTimersByTime(100);
    });

    expect(r1Dialog.show).not.toHaveBeenCalled();
    expect(r2Dialog.show).toHaveBeenCalledTimes(1);
    expect(lifecycle.onSettleReview).not.toHaveBeenCalled();
  });

  it('does not let the old R1 onClose clear the R2 timer or close R2', () => {
    const lifecycle = setupReviewLifecycle({ initialReviewRevision: 'R1' });
    const r1Dialog = createDialog();
    const r2Dialog = createDialog();

    act(() => {
      lifecycle.result.current.scheduleReview('R1', r1Dialog.show);
      jest.advanceTimersByTime(100);
    });
    expect(r1Dialog.show).toHaveBeenCalledTimes(1);

    act(() => {
      lifecycle.updateReview('R2');
      lifecycle.result.current.scheduleReview('R2', r2Dialog.show);
    });
    expect(r1Dialog.close).toHaveBeenCalledTimes(1);

    act(() => {
      r1Dialog.getHandlers()?.onClose();
      jest.advanceTimersByTime(100);
    });
    expect(r2Dialog.show).toHaveBeenCalledTimes(1);
    expect(r2Dialog.close).not.toHaveBeenCalled();
    expect(lifecycle.onSettleReview).not.toHaveBeenCalled();
    expect(lifecycle.onClearCurrentReview).not.toHaveBeenCalled();
    expect(lifecycle.onClearReviewSteps).not.toHaveBeenCalled();

    act(() => {
      r1Dialog.getHandlers()?.onClose();
    });
    expect(r2Dialog.close).not.toHaveBeenCalled();

    act(() => {
      r2Dialog.getHandlers()?.onDone();
    });
    expect(r2Dialog.close).toHaveBeenCalledTimes(1);
    expect(lifecycle.onSettleReview).toHaveBeenCalledTimes(1);
    expect(lifecycle.onClearCurrentReview).toHaveBeenCalledWith('R2');
  });

  it('does not let the delayed R1 cleanup clear R2 steps', () => {
    const lifecycle = setupReviewLifecycle({ initialReviewRevision: 'R1' });
    const r1Dialog = createDialog();
    const r2Dialog = createDialog();

    act(() => {
      lifecycle.result.current.scheduleReview('R1', r1Dialog.show);
      jest.advanceTimersByTime(100);
      r1Dialog.getHandlers()?.onDone();
      lifecycle.updateReview('R2');
      lifecycle.result.current.scheduleReview('R2', r2Dialog.show);
      jest.advanceTimersByTime(100);
    });

    expect(r2Dialog.show).toHaveBeenCalledTimes(1);
    expect(lifecycle.onClearReviewSteps).not.toHaveBeenCalled();
  });

  it('does not show a scheduled dialog after unmount', () => {
    const lifecycle = setupReviewLifecycle({ initialReviewRevision: 'R1' });
    const dialog = createDialog();

    act(() => {
      lifecycle.result.current.scheduleReview('R1', dialog.show);
      lifecycle.unmount();
      jest.advanceTimersByTime(100);
    });

    expect(dialog.show).not.toHaveBeenCalled();
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it('closes and aborts an active review on unmount without settling state', () => {
    const lifecycle = setupReviewLifecycle({ initialReviewRevision: 'R1' });
    const dialog = createDialog({ forwardOnCloseAfterMs: 300 });

    act(() => {
      lifecycle.result.current.scheduleReview('R1', dialog.show);
      jest.advanceTimersByTime(100);
      lifecycle.unmount();
    });

    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(lifecycle.onAbortEstimateFee).toHaveBeenCalledTimes(1);
    expect(lifecycle.onSettleReview).not.toHaveBeenCalled();
    expect(lifecycle.onClearCurrentReview).not.toHaveBeenCalled();
    expect(lifecycle.onClearReviewSteps).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(lifecycle.onAbortEstimateFee).toHaveBeenCalledTimes(1);
    expect(lifecycle.onSettleReview).not.toHaveBeenCalled();
    expect(lifecycle.onClearCurrentReview).not.toHaveBeenCalled();
    expect(lifecycle.onClearReviewSteps).not.toHaveBeenCalled();
  });

  it('settles once when onDone is followed by the dialog delayed onClose', () => {
    const lifecycle = setupReviewLifecycle({ initialReviewRevision: 'R1' });
    const dialog = createDialog({ forwardOnCloseAfterMs: 300 });

    act(() => {
      lifecycle.result.current.scheduleReview('R1', dialog.show);
      jest.advanceTimersByTime(100);
      dialog.getHandlers()?.onDone();
      jest.advanceTimersByTime(300);
    });

    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(lifecycle.onSettleReview).toHaveBeenCalledTimes(1);
    expect(lifecycle.onClearCurrentReview).toHaveBeenCalledTimes(1);
    expect(lifecycle.onAbortEstimateFee).toHaveBeenCalledTimes(1);
    expect(lifecycle.onClearReviewSteps).toHaveBeenCalledTimes(1);
  });

  it('closes and settles the active dialog when the snapshot disappears', () => {
    const lifecycle = setupReviewLifecycle({ initialReviewRevision: 'R1' });
    const dialog = createDialog();

    act(() => {
      lifecycle.result.current.scheduleReview('R1', dialog.show);
      jest.advanceTimersByTime(100);
      lifecycle.updateReview(undefined, false);
    });

    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(lifecycle.onSettleReview).toHaveBeenCalledTimes(1);
    expect(lifecycle.onClearCurrentReview).not.toHaveBeenCalled();
    expect(lifecycle.onAbortEstimateFee).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(lifecycle.onClearReviewSteps).toHaveBeenCalledTimes(1);
  });

  it('keeps an ordinary Swap review open across Stock gate and quote session changes', () => {
    const ordinarySnapshot = {
      reviewRevision: 'R1',
      swapType: ESwapTabSwitchType.SWAP,
    } as ISwapExecutionSnapshot;
    const stockToken = {
      contractAddress: '0xstock',
      isStock: true,
      networkId: 'evm--1',
    } as ISwapToken;
    const closedGate: ISwapStockMarketQuoteGate = {
      ownerStockKey: 'unrelated-stock-owner',
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    const idleSession: ISwapQuoteSessionState = {
      intentRevision: 0,
      lastSequence: 0,
      phase: 'idle',
    };
    const cancelledSession: ISwapQuoteSessionState = {
      intentRevision: 99,
      lastSequence: 0,
      phase: 'cancelled',
    };
    const initialGuard = resolveSwapReviewExecutionGuardState({
      quoteSessionState: idleSession,
      snapshot: ordinarySnapshot,
      stockMarketQuoteGate: undefined,
    });
    const changedGuard = resolveSwapReviewExecutionGuardState({
      quoteSessionState: cancelledSession,
      snapshot: {
        ...ordinarySnapshot,
        fromToken: stockToken,
      },
      stockMarketQuoteGate: closedGate,
    });
    expect(initialGuard.blocked).toBe(false);
    expect(changedGuard.blocked).toBe(false);

    const lifecycle = setupReviewLifecycle({
      initialReviewRevision: 'R1',
      initialReviewValid: !initialGuard.blocked,
    });
    const dialog = createDialog();
    act(() => {
      lifecycle.result.current.scheduleReview('R1', dialog.show);
      jest.advanceTimersByTime(100);
      lifecycle.updateReview('R1', !changedGuard.blocked);
    });

    expect(dialog.show).toHaveBeenCalledTimes(1);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(lifecycle.onSettleReview).not.toHaveBeenCalled();
  });
});
