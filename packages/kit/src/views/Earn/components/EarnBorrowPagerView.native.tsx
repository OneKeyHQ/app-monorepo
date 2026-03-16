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

import type { IEarnHomeMode } from './MarketSelector';
import type {
  PageScrollStateChangedNativeEvent,
  PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';

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

// --- Types ---

export interface IEarnBorrowPagerViewRef {
  syncCurrentPage: () => void;
}

interface IEarnBorrowPagerViewProps {
  mode: IEarnHomeMode;
  onModeChange: (mode: IEarnHomeMode) => void;
  earnContent: React.ReactNode;
  borrowContent: React.ReactNode;
}

// --- Component ---

function EarnBorrowPagerViewComponent(
  { mode, onModeChange, earnContent, borrowContent }: IEarnBorrowPagerViewProps,
  ref: React.Ref<IEarnBorrowPagerViewRef>,
) {
  const pagerRef = useRef<PagerView>(null);
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
  }, [mode]);

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
    <PagerView
      ref={pagerRef}
      style={styles.pager}
      initialPage={MODE_TO_INDEX[mode]}
      overdrag={false}
      overScrollMode="never"
      nestedScrollEnabled
      scrollSensitivity={4}
      onPageScrollStateChanged={handlePageScrollStateChanged}
      onPageSelected={handlePageSelected}
    >
      <View key="earn" style={styles.page}>
        {earnContent}
      </View>
      <View key="borrow" style={styles.page}>
        {borrowContent}
      </View>
    </PagerView>
  );
}

export const EarnBorrowPagerView = memo(
  forwardRef<IEarnBorrowPagerViewRef, IEarnBorrowPagerViewProps>(
    EarnBorrowPagerViewComponent,
  ),
);
