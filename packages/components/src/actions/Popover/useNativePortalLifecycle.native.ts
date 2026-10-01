import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  IUseNativePortalLifecycleProps,
  IUseNativePortalLifecycleResult,
} from './nativePortalLifecycleTypes';

const NATIVE_PORTAL_CLOSE_FALLBACK_DELAY = 1000;

export function useNativePortalLifecycle({
  isOpen,
  sheetProps,
}: IUseNativePortalLifecycleProps): IUseNativePortalLifecycleResult {
  // Every native sheet must survive until its exit callback, including
  // ordinary declarative popovers that did not opt into pre-mounting.
  const shouldUseNativePortalLifecycle = true;
  const [isNativePortalMounted, setIsNativePortalMounted] = useState(false);
  const [isNativeSheetOpen, setIsNativeSheetOpen] = useState(false);
  const desiredOpenRef = useRef(Boolean(isOpen));
  const hasOpenedNativeSheetRef = useRef(false);
  const closeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  desiredOpenRef.current = Boolean(isOpen);

  const clearCloseFallbackTimer = useCallback(() => {
    if (closeFallbackTimerRef.current) {
      clearTimeout(closeFallbackTimerRef.current);
      closeFallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      clearCloseFallbackTimer();
      setIsNativePortalMounted(true);
      return;
    }

    setIsNativeSheetOpen(false);
    if (!hasOpenedNativeSheetRef.current) {
      setIsNativePortalMounted(false);
      return;
    }

    clearCloseFallbackTimer();
    closeFallbackTimerRef.current = setTimeout(() => {
      closeFallbackTimerRef.current = null;
      if (!desiredOpenRef.current) {
        hasOpenedNativeSheetRef.current = false;
        setIsNativePortalMounted(false);
      }
    }, NATIVE_PORTAL_CLOSE_FALLBACK_DELAY);
  }, [clearCloseFallbackTimer, isOpen]);

  useEffect(() => {
    if (!isOpen || !isNativePortalMounted) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (desiredOpenRef.current) {
        hasOpenedNativeSheetRef.current = true;
        setIsNativeSheetOpen(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isNativePortalMounted, isOpen]);

  useEffect(
    () => () => {
      clearCloseFallbackTimer();
    },
    [clearCloseFallbackTimer],
  );

  const handleSheetAnimationComplete = useCallback(
    (info: { open: boolean }) => {
      sheetProps?.onAnimationComplete?.(info);
      if (info.open || desiredOpenRef.current) {
        return;
      }
      clearCloseFallbackTimer();
      hasOpenedNativeSheetRef.current = false;
      setIsNativePortalMounted(false);
    },
    [clearCloseFallbackTimer, sheetProps],
  );

  const resolvedSheetProps = useMemo(
    () => ({
      ...sheetProps,
      onAnimationComplete: handleSheetAnimationComplete,
    }),
    [handleSheetAnimationComplete, sheetProps],
  );

  return {
    shouldUseNativePortalLifecycle,
    isNativePortalMounted,
    popoverOpen: isNativeSheetOpen,
    resolvedSheetProps,
  };
}
