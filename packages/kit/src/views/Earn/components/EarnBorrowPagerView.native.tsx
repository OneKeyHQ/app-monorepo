import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, {
  useAnimatedRef,
  useEvent,
  useHandler,
} from 'react-native-reanimated';

import type { IEarnHomeMode } from './MarketSelector';
import type {
  PageScrollStateChangedNativeEvent,
  PagerViewOnPageScrollEvent,
  PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import type { SharedValue } from 'react-native-reanimated';

// --- AnimatedPagerView: enables worklet-based onPageScroll on the UI thread ---

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

// --- Styles ---

const styles = StyleSheet.create({
  pager: { flex: 1 },
  page: { flex: 1 },
});

// --- Mode <-> Index mapping ---

const MODE_TO_INDEX: Record<IEarnHomeMode, number> = {
  earn: 0,
  borrow: 1,
};
const INDEX_TO_MODE: IEarnHomeMode[] = ['earn', 'borrow'];

// --- Worklet-based page scroll handler (same pattern as collapsible-tab-view) ---

function usePageScrollHandler(
  handlers: {
    onPageScroll: (
      event: PagerViewOnPageScrollEvent['nativeEvent'],
      context: Record<string, unknown>,
    ) => void;
  },
  dependencies?: unknown[],
): (event: PagerViewOnPageScrollEvent) => void {
  const { context, doDependenciesDiffer } = useHandler(handlers, dependencies);

  // Reanimated's useEvent return type (EventHandlerProcessed) doesn't match
  // AnimatedPagerView's onPageScroll prop (DirectEventHandler), but they are
  // compatible at runtime — Reanimated intercepts the native event internally.
  return useEvent(
    (
      event: { eventName: string } & PagerViewOnPageScrollEvent['nativeEvent'],
    ) => {
      'worklet';

      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith('onPageScroll')) {
        onPageScroll(event, context);
      }
    },
    ['onPageScroll'],
    doDependenciesDiffer,
  ) as unknown as (event: PagerViewOnPageScrollEvent) => void;
}

// --- Types ---

export interface IEarnBorrowPagerViewRef {
  syncCurrentPage: () => void;
}

interface IEarnBorrowPagerViewProps {
  mode: IEarnHomeMode;
  onModeChange: (mode: IEarnHomeMode) => void;
  earnContent: React.ReactNode;
  borrowContent: React.ReactNode;
  pageScrollPosition?: SharedValue<number>;
}

// --- Component ---

function EarnBorrowPagerViewComponent(
  {
    mode,
    onModeChange,
    earnContent,
    borrowContent,
    pageScrollPosition,
  }: IEarnBorrowPagerViewProps,
  ref: React.Ref<IEarnBorrowPagerViewRef>,
) {
  const pagerRef = useAnimatedRef<PagerView>();
  const currentIndexRef = useRef(MODE_TO_INDEX[mode]);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Track whether the user is actively dragging. Used to distinguish user swipes
  // from spurious onPageSelected events fired by iOS when react-freeze unfreezes
  // the native UIScrollView (which resets contentOffset to page 0).
  const wasUserDragRef = useRef(false);

  // Expose syncCurrentPage for freeze/unfreeze resync.
  // Uses modeRef (React state) instead of currentIndexRef, because on iOS the
  // spurious onPageSelected(0) during unfreeze may have already corrupted
  // currentIndexRef to 0.
  useImperativeHandle(ref, () => ({
    syncCurrentPage: () => {
      const index = MODE_TO_INDEX[modeRef.current];
      pagerRef.current?.setPageWithoutAnimation(index);
      currentIndexRef.current = index;
    },
  }));

  // mode -> PagerView sync (programmatic switching with index guard)
  useEffect(() => {
    const index = MODE_TO_INDEX[mode];
    if (index !== undefined && index !== currentIndexRef.current) {
      pagerRef.current?.setPage(index);
      currentIndexRef.current = index;
    }
  }, [mode, pagerRef]);

  // Track drag state: 'dragging' → wasUserDrag=true, 'idle' → wasUserDrag=false.
  // A user swipe sequence is: dragging → settling → onPageSelected → idle.
  // A freeze/unfreeze reset fires onPageSelected without any dragging event.
  const handlePageScrollStateChanged = useCallback(
    (e: PageScrollStateChangedNativeEvent) => {
      const state = e.nativeEvent.pageScrollState;
      if (state === 'dragging') {
        wasUserDragRef.current = true;
      } else if (state === 'idle') {
        wasUserDragRef.current = false;
      }
    },
    [],
  );

  // Worklet-based onPageScroll: updates pageScrollPosition on the UI thread
  // with zero bridge overhead for smooth animated tab indicator.
  const pageScrollHandler = usePageScrollHandler({
    onPageScroll: (e) => {
      'worklet';

      if (pageScrollPosition) {
        pageScrollPosition.value = e.position + e.offset;
      }
    },
  });

  // PagerView -> mode sync (gesture swiping only)
  const handlePageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const position = e.nativeEvent.position;
      currentIndexRef.current = position;

      // Only propagate mode change when triggered by a user gesture.
      // Ignore spurious onPageSelected fired by iOS when react-freeze
      // unfreezes the native PagerView (UIScrollView resets to page 0).
      if (!wasUserDragRef.current) return;

      const newMode = INDEX_TO_MODE[position];
      if (newMode && newMode !== modeRef.current) {
        onModeChange(newMode);
      }
    },
    [onModeChange],
  );

  return (
    <AnimatedPagerView
      ref={pagerRef}
      style={styles.pager}
      initialPage={MODE_TO_INDEX[mode]}
      overdrag={false}
      overScrollMode="never"
      nestedScrollEnabled
      scrollSensitivity={4}
      onPageScroll={pageScrollHandler}
      onPageScrollStateChanged={handlePageScrollStateChanged}
      onPageSelected={handlePageSelected}
    >
      <View key="earn" style={styles.page}>
        {earnContent}
      </View>
      <View key="borrow" style={styles.page}>
        {borrowContent}
      </View>
    </AnimatedPagerView>
  );
}

export const EarnBorrowPagerView = memo(
  forwardRef<IEarnBorrowPagerViewRef, IEarnBorrowPagerViewProps>(
    EarnBorrowPagerViewComponent,
  ),
);
