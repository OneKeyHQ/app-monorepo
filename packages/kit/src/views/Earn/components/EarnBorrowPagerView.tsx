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
import type { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';

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

  // Expose syncCurrentPage for freeze/unfreeze resync
  useImperativeHandle(ref, () => ({
    syncCurrentPage: () => {
      pagerRef.current?.setPageWithoutAnimation(currentIndexRef.current);
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

  // PagerView -> mode sync (gesture swiping)
  const handlePageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const position = e.nativeEvent.position;
      currentIndexRef.current = position;
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
