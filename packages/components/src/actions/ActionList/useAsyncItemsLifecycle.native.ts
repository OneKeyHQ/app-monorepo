import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type {
  IResolvedAsyncItems,
  IUseAsyncItemsLifecycleProps,
  IUseAsyncItemsLifecycleResult,
} from './asyncItemsLifecycleTypes';

const ASYNC_ITEMS_ANIMATION_FALLBACK_DELAY = 1000;

export function useAsyncItemsLifecycle({
  isOpen,
  renderItemsAsync,
  handleActionListCloseRef,
  handleActionListOpenRef,
  sheetProps,
}: IUseAsyncItemsLifecycleProps): IUseAsyncItemsLifecycleResult {
  const [asyncItems, setAsyncItems] = useState<IResolvedAsyncItems>();
  const isOpenRef = useRef(isOpen);
  const isOpenAnimationCompleteRef = useRef(false);
  const requestIdRef = useRef(0);
  const pendingAsyncItemsRef = useRef<IResolvedAsyncItems | undefined>(
    undefined,
  );
  const renderItemsAsyncRef = useRef(renderItemsAsync);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  isOpenRef.current = isOpen;
  renderItemsAsyncRef.current = renderItemsAsync;

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearFallbackTimer(), [clearFallbackTimer]);

  const commitPendingAsyncItems = useCallback(() => {
    const pendingItems = pendingAsyncItemsRef.current;
    if (
      !pendingItems ||
      !isOpenRef.current ||
      pendingItems.requestId !== requestIdRef.current
    ) {
      return;
    }
    pendingAsyncItemsRef.current = undefined;
    setAsyncItems(pendingItems);
  }, []);

  const handleSheetAnimationComplete = useCallback(
    (info: { open: boolean }) => {
      sheetProps?.onAnimationComplete?.(info);
      if (!info.open) {
        clearFallbackTimer();
        if (!isOpenRef.current) {
          setAsyncItems(undefined);
        }
        return;
      }
      if (!isOpenRef.current) {
        return;
      }
      isOpenAnimationCompleteRef.current = true;
      clearFallbackTimer();
      commitPendingAsyncItems();
    },
    [clearFallbackTimer, commitPendingAsyncItems, sheetProps],
  );

  const resolvedSheetProps = useMemo(
    () => ({
      ...sheetProps,
      onAnimationComplete: handleSheetAnimationComplete,
    }),
    [handleSheetAnimationComplete, sheetProps],
  );

  const handleAsyncItemsOpenChange = useCallback(
    (openStatus: boolean) => {
      isOpenRef.current = openStatus;
      clearFallbackTimer();
      if (openStatus) {
        isOpenAnimationCompleteRef.current = false;
        return;
      }
      requestIdRef.current += 1;
      pendingAsyncItemsRef.current = undefined;
      fallbackTimerRef.current = setTimeout(() => {
        fallbackTimerRef.current = null;
        if (!isOpenRef.current) {
          setAsyncItems(undefined);
        }
      }, ASYNC_ITEMS_ANIMATION_FALLBACK_DELAY);
    },
    [clearFallbackTimer],
  );

  const hasRenderItemsAsync = Boolean(renderItemsAsync);
  useEffect(() => {
    const currentRenderItemsAsync = renderItemsAsyncRef.current;
    if (!currentRenderItemsAsync || !isOpen) {
      return;
    }

    let isActive = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    pendingAsyncItemsRef.current = undefined;

    if (!isOpenAnimationCompleteRef.current) {
      clearFallbackTimer();
      fallbackTimerRef.current = setTimeout(() => {
        fallbackTimerRef.current = null;
        if (!isActive || !isOpenRef.current) {
          return;
        }
        isOpenAnimationCompleteRef.current = true;
        commitPendingAsyncItems();
      }, ASYNC_ITEMS_ANIMATION_FALLBACK_DELAY);
    }

    void currentRenderItemsAsync({
      handleActionListClose: handleActionListCloseRef.current,
      handleActionListOpen: handleActionListOpenRef.current,
    })
      .then((items) => {
        if (
          !isActive ||
          !isOpenRef.current ||
          requestId !== requestIdRef.current
        ) {
          return;
        }
        pendingAsyncItemsRef.current = { requestId, items };
        if (isOpenAnimationCompleteRef.current) {
          commitPendingAsyncItems();
        }
      })
      .catch((error: unknown) => {
        if (!isActive || requestId !== requestIdRef.current) {
          return;
        }
        const message =
          error instanceof Error ? error.message : String(error ?? 'unknown');
        defaultLogger.app.error.log(
          `[ActionList] renderItemsAsync failed: ${message}`,
        );
      });

    return () => {
      isActive = false;
      if (requestId === requestIdRef.current) {
        clearFallbackTimer();
      }
    };
  }, [
    clearFallbackTimer,
    commitPendingAsyncItems,
    handleActionListCloseRef,
    handleActionListOpenRef,
    hasRenderItemsAsync,
    isOpen,
  ]);

  return {
    asyncItems,
    handleAsyncItemsOpenChange,
    resolvedSheetProps,
  };
}
