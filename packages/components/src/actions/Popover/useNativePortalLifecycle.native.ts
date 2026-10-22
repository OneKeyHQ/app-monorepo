import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  IUseNativePortalLifecycleProps,
  IUseNativePortalLifecycleResult,
} from './nativePortalLifecycleTypes';

const NATIVE_PORTAL_CLOSE_FALLBACK_DELAY = 5500;

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
  const previousOpenRef = useRef(false);
  const openCycleRef = useRef(0);
  if (isOpen && !previousOpenRef.current) openCycleRef.current += 1;
  previousOpenRef.current = Boolean(isOpen);
  const renderCycle = openCycleRef.current;
  const hasOpenedNativeSheetRef = useRef(false);
  const hadOpenAttemptRef = useRef(false);
  const sheetPropsRef = useRef(sheetProps);
  const closeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  desiredOpenRef.current = Boolean(isOpen);
  sheetPropsRef.current = sheetProps;

  const clearCloseFallbackTimer = useCallback(() => {
    if (closeFallbackTimerRef.current) {
      clearTimeout(closeFallbackTimerRef.current);
      closeFallbackTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      hadOpenAttemptRef.current = true;
      clearCloseFallbackTimer();
      setIsNativePortalMounted(true);
      return;
    }

    setIsNativeSheetOpen(false);
    if (!hasOpenedNativeSheetRef.current) {
      setIsNativePortalMounted(false);
      if (hadOpenAttemptRef.current) {
        hadOpenAttemptRef.current = false;
        sheetPropsRef.current?.onAnimationComplete?.({ open: false });
      }
      return;
    }

    clearCloseFallbackTimer();
    const closeCycle = openCycleRef.current;
    closeFallbackTimerRef.current = setTimeout(() => {
      closeFallbackTimerRef.current = null;
      if (!desiredOpenRef.current && closeCycle === openCycleRef.current) {
        hasOpenedNativeSheetRef.current = false;
        hadOpenAttemptRef.current = false;
        setIsNativePortalMounted(false);
        sheetPropsRef.current?.onAnimationComplete?.({ open: false });
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
      if (
        renderCycle !== openCycleRef.current ||
        (info.open && !desiredOpenRef.current) ||
        (!info.open && !hadOpenAttemptRef.current)
      ) {
        return;
      }
      if (!info.open) {
        clearCloseFallbackTimer();
        hasOpenedNativeSheetRef.current = false;
        hadOpenAttemptRef.current = false;
        setIsNativePortalMounted(false);
      }
      sheetProps?.onAnimationComplete?.(info);
    },
    [clearCloseFallbackTimer, renderCycle, sheetProps],
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
