import { useCallback, useEffect, useRef, useState } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type {
  IResolvedAsyncItems,
  IUseAsyncItemsLifecycleProps,
  IUseAsyncItemsLifecycleResult,
} from './asyncItemsLifecycleTypes';

export function useAsyncItemsLifecycle({
  isOpen,
  renderItemsAsync,
  handleActionListCloseRef,
  handleActionListOpenRef,
  sheetProps,
}: IUseAsyncItemsLifecycleProps): IUseAsyncItemsLifecycleResult {
  const [asyncItems, setAsyncItems] = useState<IResolvedAsyncItems>();
  const isOpenRef = useRef(isOpen);
  const requestIdRef = useRef(0);
  const renderItemsAsyncRef = useRef(renderItemsAsync);
  isOpenRef.current = isOpen;
  renderItemsAsyncRef.current = renderItemsAsync;

  const handleAsyncItemsOpenChange = useCallback((openStatus: boolean) => {
    isOpenRef.current = openStatus;
    if (!openStatus) {
      requestIdRef.current += 1;
      setAsyncItems(undefined);
    }
  }, []);

  const hasRenderItemsAsync = Boolean(renderItemsAsync);
  useEffect(() => {
    const currentRenderItemsAsync = renderItemsAsyncRef.current;
    if (!currentRenderItemsAsync || !isOpen) {
      if (!currentRenderItemsAsync) {
        setAsyncItems(undefined);
      }
      return;
    }

    let isActive = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void currentRenderItemsAsync({
      handleActionListClose: handleActionListCloseRef.current,
      handleActionListOpen: handleActionListOpenRef.current,
    })
      .then((items) => {
        if (
          isActive &&
          isOpenRef.current &&
          requestId === requestIdRef.current
        ) {
          setAsyncItems({ requestId, items });
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
    };
  }, [
    handleActionListCloseRef,
    handleActionListOpenRef,
    hasRenderItemsAsync,
    isOpen,
  ]);

  return {
    asyncItems,
    handleAsyncItemsOpenChange,
    resolvedSheetProps: sheetProps,
  };
}
