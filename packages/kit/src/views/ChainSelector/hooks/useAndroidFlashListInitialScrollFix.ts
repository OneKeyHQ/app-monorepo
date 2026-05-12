import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// FlashList v2 may re-anchor Android scroll position after async data
// replaces the initial list. Re-apply the selected position once the
// committed data has settled: the setTimeout(0) catches the post-commit
// frame and the delayed timer covers FlashList's later internal re-anchor.
const ANDROID_RESTORE_DELAY_MS = 120;

const androidScrollProps = {
  maintainVisibleContentPosition: {
    disabled: true,
  },
} as const;

const emptyScrollProps: Record<string, unknown> = {};

type IScrollableRef = {
  scrollToIndex?: (params: { index: number; animated?: boolean }) => void;
};

export function useAndroidFlashListInitialScrollFix({
  listRef,
  initialIndex,
  enabled,
  contentKey,
}: {
  listRef: RefObject<IScrollableRef | null>;
  initialIndex: number | undefined;
  enabled: boolean;
  // Reference whose change signals an async data swap that may have
  // re-anchored the scroll position (typically the sections array).
  contentKey?: unknown;
}): {
  scrollProps: Record<string, unknown>;
  onScrollBeginDrag: () => void;
} {
  const hasUserScrolledRef = useRef(false);

  useEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      return undefined;
    }
    if (!enabled || initialIndex === undefined || hasUserScrolledRef.current) {
      return undefined;
    }
    const scrollToTarget = () => {
      if (hasUserScrolledRef.current) {
        return;
      }
      listRef.current?.scrollToIndex?.({
        index: initialIndex,
        animated: false,
      });
    };
    const timerIds = [
      setTimeout(scrollToTarget, 0),
      setTimeout(scrollToTarget, ANDROID_RESTORE_DELAY_MS),
    ];
    return () => {
      timerIds.forEach(clearTimeout);
    };
  }, [enabled, initialIndex, contentKey, listRef]);

  const onScrollBeginDrag = useCallback(() => {
    hasUserScrolledRef.current = true;
  }, []);

  return {
    scrollProps: platformEnv.isNativeAndroid
      ? (androidScrollProps as Record<string, unknown>)
      : emptyScrollProps,
    onScrollBeginDrag,
  };
}
