import { useCallback, useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';

type IReviewDialogHandlers = {
  onClose: () => void;
  onDone: () => void;
};

type IShowReviewDialog = (handlers: IReviewDialogHandlers) => IDialogInstance;

type IUseSwapReviewDialogLifecycleParams = {
  currentReviewRevision?: string;
  isCurrentReviewValid: boolean;
  getCurrentReviewRevision: () => string | undefined;
  isReviewRevisionCurrent: (reviewRevision: string) => boolean;
  onSettleReview: () => void;
  onClearCurrentReview: (reviewRevision: string) => void;
  onAbortEstimateFee: () => void;
  onClearReviewSteps: () => void;
};

type IReviewLease = {
  reviewRevision: string;
  cleanupHandled: boolean;
};

type IScheduledReview = {
  lease: IReviewLease;
  timerId: ReturnType<typeof setTimeout>;
};

type IActiveReviewDialog = {
  instance: IDialogInstance;
  lease: IReviewLease;
};

const REVIEW_SHOW_DELAY_MS = 100;
const REVIEW_STEPS_CLEAR_DELAY_MS = 100;

export function useSwapReviewDialogLifecycle({
  currentReviewRevision,
  isCurrentReviewValid,
  getCurrentReviewRevision,
  isReviewRevisionCurrent,
  onSettleReview,
  onClearCurrentReview,
  onAbortEstimateFee,
  onClearReviewSteps,
}: IUseSwapReviewDialogLifecycleParams) {
  const callbacksRef = useRef({
    getCurrentReviewRevision,
    isReviewRevisionCurrent,
    onAbortEstimateFee,
    onClearCurrentReview,
    onClearReviewSteps,
    onSettleReview,
  });
  callbacksRef.current = {
    getCurrentReviewRevision,
    isReviewRevisionCurrent,
    onAbortEstimateFee,
    onClearCurrentReview,
    onClearReviewSteps,
    onSettleReview,
  };

  const activeDialogRef = useRef<IActiveReviewDialog | null>(null);
  const scheduledReviewRef = useRef<IScheduledReview | null>(null);
  const isMountedRef = useRef(true);

  const clearScheduledReview = useCallback((reviewRevision?: string) => {
    const scheduled = scheduledReviewRef.current;
    if (
      !scheduled ||
      (reviewRevision && scheduled.lease.reviewRevision !== reviewRevision)
    ) {
      return;
    }
    clearTimeout(scheduled.timerId);
    scheduledReviewRef.current = null;
  }, []);

  const cleanupReview = useCallback(
    (lease: IReviewLease) => {
      if (lease.cleanupHandled) {
        return;
      }
      const { reviewRevision } = lease;
      clearScheduledReview(reviewRevision);
      const currentReviewRevisionValue =
        callbacksRef.current.getCurrentReviewRevision();
      if (!isMountedRef.current) {
        return;
      }
      if (
        currentReviewRevisionValue &&
        currentReviewRevisionValue !== reviewRevision
      ) {
        lease.cleanupHandled = true;
        return;
      }

      lease.cleanupHandled = true;
      callbacksRef.current.onSettleReview();
      if (currentReviewRevisionValue === reviewRevision) {
        callbacksRef.current.onClearCurrentReview(reviewRevision);
      }
      callbacksRef.current.onAbortEstimateFee();

      setTimeout(() => {
        if (
          !isMountedRef.current ||
          callbacksRef.current.getCurrentReviewRevision()
        ) {
          return;
        }
        callbacksRef.current.onClearReviewSteps();
      }, REVIEW_STEPS_CLEAR_DELAY_MS);
    },
    [clearScheduledReview],
  );

  const handleReviewDialogClosed = useCallback(
    (lease: IReviewLease) => {
      if (activeDialogRef.current?.lease === lease) {
        activeDialogRef.current = null;
      }
      cleanupReview(lease);
    },
    [cleanupReview],
  );

  const closeReview = useCallback(
    (lease: IReviewLease) => {
      clearScheduledReview(lease.reviewRevision);
      const activeDialog = activeDialogRef.current;
      if (activeDialog?.lease === lease) {
        activeDialogRef.current = null;
        void activeDialog.instance.close();
      }
      cleanupReview(lease);
    },
    [cleanupReview, clearScheduledReview],
  );

  const scheduleReview = useCallback(
    (reviewRevision: string, showReviewDialog: IShowReviewDialog) => {
      clearScheduledReview();
      const lease: IReviewLease = {
        cleanupHandled: false,
        reviewRevision,
      };
      const timerId = setTimeout(() => {
        if (scheduledReviewRef.current?.lease === lease) {
          scheduledReviewRef.current = null;
        }
        if (!callbacksRef.current.isReviewRevisionCurrent(reviewRevision)) {
          cleanupReview(lease);
          return;
        }

        const instance = showReviewDialog({
          onClose: () => handleReviewDialogClosed(lease),
          onDone: () => closeReview(lease),
        });
        if (!callbacksRef.current.isReviewRevisionCurrent(reviewRevision)) {
          void instance.close();
          cleanupReview(lease);
          return;
        }
        activeDialogRef.current = { instance, lease };
      }, REVIEW_SHOW_DELAY_MS);
      scheduledReviewRef.current = { lease, timerId };
    },
    [
      cleanupReview,
      clearScheduledReview,
      closeReview,
      handleReviewDialogClosed,
    ],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearScheduledReview();
      const activeDialog = activeDialogRef.current;
      activeDialogRef.current = null;
      if (activeDialog) {
        activeDialog.lease.cleanupHandled = true;
        callbacksRef.current.onAbortEstimateFee();
        void activeDialog.instance.close();
      }
    };
  }, [clearScheduledReview]);

  useEffect(() => {
    const activeDialog = activeDialogRef.current;
    if (!activeDialog) {
      return;
    }
    if (
      !currentReviewRevision ||
      activeDialog.lease.reviewRevision !== currentReviewRevision ||
      !isCurrentReviewValid
    ) {
      closeReview(activeDialog.lease);
    }
  }, [closeReview, currentReviewRevision, isCurrentReviewValid]);

  return { scheduleReview };
}
