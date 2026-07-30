import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useDatePickerContext } from '@rehookify/datepicker';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Stack, YStack } from '../../primitives';
import { s } from '../../utils/scale';

import { DayGrid, MonthDaysGrid, WeekdayRow } from './DayGrid';
import { computeSwipeTarget } from './swipeUtils';
import {
  CALENDAR_CURRENT,
  CALENDAR_NEXT,
  CALENDAR_PREV,
  useSwipeMonthNavEnabled,
} from './useSwipeMonthNavEnabled';
import { callOnClick } from './utils';

import type { ISwipeableDayGridProps } from './SwipeableDayGridTypes';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

// Keep in sync with CELL_SIZE ($10) in DayCell.tsx and the day grid rowGap
// ($1) in MonthDaysGrid — token values go through the uiScale factor.
const DAY_CELL_HEIGHT = s(40);
const ROW_GAP = s(4);

// Critically damped, no overshoot: pages settle straight onto the target.
// Mirrors CONTENT_SPRING_CONFIG in FeaturedCarousel/constants.ts.
const PAGE_SPRING_CONFIG = {
  stiffness: 220,
  damping: 30,
  mass: 1,
  overshootClamping: true,
} as const;

// Horizontal pan must not steal the sheet's vertical drag or inner scroll.
const PAN_ACTIVE_OFFSET_X: [number, number] = [-10, 10];
const PAN_FAIL_OFFSET_Y: [number, number] = [-15, 15];

// Damping for dragging beyond a minDate/maxDate boundary.
const RUBBER_BAND_FACTOR = 0.33;

// RNGH's root view defaults to { flex: 1 }; size to content instead.
const rootViewStyle: ViewStyle = { flex: 0 };
// `overflow` is typed loosely on ViewStyle; annotate explicitly so this
// object composes cleanly with Animated.View's style array/AnimatedStyle union.
const pagerClipStyle: ViewStyle = { overflow: 'hidden' };
// Zero-height width probe: absolutely positioned so it never affects layout.
const widthProbeStyle: ViewStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 0,
};

const FALLBACK_CELL_COUNT = 42;

function gridHeight(rows: number) {
  'worklet';

  return rows * DAY_CELL_HEIGHT + Math.max(rows - 1, 0) * ROW_GAP;
}

function PagerPage({
  index,
  pageIndex,
  pageWidth,
  calendarIndex,
  fullWidth,
}: {
  index: number;
  pageIndex: SharedValue<number>;
  pageWidth: number;
  calendarIndex: number;
  fullWidth?: boolean;
}) {
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: (index - pageIndex.value) * pageWidth }],
    }),
    [index, pageWidth],
  );

  const pageStyle = useMemo(
    () => [
      {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: pageWidth,
      },
      animatedStyle,
    ],
    [pageWidth, animatedStyle],
  );

  return (
    <Animated.View style={pageStyle}>
      <MonthDaysGrid
        calendarIndex={calendarIndex}
        hideOutOfMonth={false}
        fullWidth={fullWidth}
      />
    </Animated.View>
  );
}

function MonthPager({
  pageWidth,
  fullWidth,
  isPrevDisabled,
  isNextDisabled,
}: Pick<
  ISwipeableDayGridProps,
  'fullWidth' | 'isPrevDisabled' | 'isNextDisabled'
> & { pageWidth: number }) {
  const { data, propGetters } = useDatePickerContext();
  const { calendars } = data;
  const { addOffset, subtractOffset } = propGetters;

  // Committed pager position. Purely positional: pages are windowed around it
  // and mapped onto the rehookify calendar slots; rehookify owns which month
  // is "current", so header chevrons keep working without touching the pager.
  const [curIndex, setCurIndex] = useState(0);
  const curIndexRef = useRef(0);
  const pageIndex = useSharedValue(0);
  const startIndex = useSharedValue(0);

  const prevRows =
    (calendars[CALENDAR_PREV]?.days.length ?? FALLBACK_CELL_COUNT) / 7;
  const centerRows =
    (calendars[CALENDAR_CURRENT]?.days.length ?? FALLBACK_CELL_COUNT) / 7;
  const nextRows =
    (calendars[CALENDAR_NEXT]?.days.length ?? FALLBACK_CELL_COUNT) / 7;

  // UI-thread copies of the committed index, nav bounds, and page row counts:
  // gesture/height worklets read these instead of JS-captured numbers so a
  // fast chained swipe never sees stale bounds across the commit re-render.
  // curIndexSV is deliberately NOT mirrored from `curIndex` here — it is
  // authoritative on the UI thread and is written directly by the gesture's
  // onEnd worklet (and by commitNavigate's refusal path) the instant a swipe
  // settles, which is earlier than any React re-render could reach it.
  const curIndexSV = useSharedValue(0);
  const prevDisabledSV = useSharedValue(!!isPrevDisabled);
  const nextDisabledSV = useSharedValue(!!isNextDisabled);
  const prevRowsSV = useSharedValue(prevRows);
  const centerRowsSV = useSharedValue(centerRows);
  const nextRowsSV = useSharedValue(nextRows);
  // JS-side mirror of the current (uncommitted-swap) row counts, so
  // commitNavigate's refusal branch can undo onEnd's speculative row-height
  // pre-shift with the values rehookify still actually reflects.
  const rowsRef = useRef({ prev: 6, center: 6, next: 6 });

  useLayoutEffect(() => {
    prevDisabledSV.value = !!isPrevDisabled;
    nextDisabledSV.value = !!isNextDisabled;
    prevRowsSV.value = prevRows;
    centerRowsSV.value = centerRows;
    nextRowsSV.value = nextRows;
    rowsRef.current = { prev: prevRows, center: centerRows, next: nextRows };
  });

  // Latest-value refs keep the gesture's onEnd worklet (captured once by
  // useMemo below) reading the current addOffset/subtractOffset instead of a
  // stale closure from the render that created the gesture. Written in
  // useLayoutEffect (commit-time only), matching MonthDaysGrid's
  // calRef/dayButtonRef pattern in DayGrid.tsx: a render-time write could leak
  // a value from an abandoned concurrent render into a commit that lands on
  // the old committed UI.
  const addOffsetRef = useRef(addOffset);
  const subtractOffsetRef = useRef(subtractOffset);
  useLayoutEffect(() => {
    addOffsetRef.current = addOffset;
    subtractOffsetRef.current = subtractOffset;
  });

  const commitNavigate = useCallback(
    (target: number) => {
      const delta = target - curIndexRef.current;
      if (delta === 0) return;
      const getter =
        delta > 0
          ? addOffsetRef.current({ months: delta })
          : subtractOffsetRef.current({ months: -delta });
      if (!getter.onClick) {
        // Rehookify refused the step (min/maxDate edge reached with stale
        // bounds): snap back so the pager stays in lockstep with the calendar,
        // and undo the row-height pre-shift from onEnd.
        curIndexSV.value = curIndexRef.current;
        prevRowsSV.value = rowsRef.current.prev;
        centerRowsSV.value = rowsRef.current.center;
        nextRowsSV.value = rowsRef.current.next;
        pageIndex.value = withSpring(curIndexRef.current, PAGE_SPRING_CONFIG);
        return;
      }
      curIndexRef.current = target;
      setCurIndex(target);
      // Sync rehookify in the same React batch: after re-render the settling
      // page renders the identical month, so the window swap is invisible.
      callOnClick(getter);
    },
    [curIndexSV, pageIndex, prevRowsSV, centerRowsSV, nextRowsSV],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(PAN_ACTIVE_OFFSET_X)
        .failOffsetY(PAN_FAIL_OFFSET_Y)
        .enabled(pageWidth > 0)
        .onStart(() => {
          'worklet';

          cancelAnimation(pageIndex);
          startIndex.value = pageIndex.value;
        })
        .onUpdate((e) => {
          'worklet';

          if (pageWidth <= 0) return;
          const minIndex = prevDisabledSV.value
            ? curIndexSV.value
            : curIndexSV.value - 1;
          const maxIndex = nextDisabledSV.value
            ? curIndexSV.value
            : curIndexSV.value + 1;
          let next = startIndex.value - e.translationX / pageWidth;
          if (next < minIndex) {
            next = minIndex + (next - minIndex) * RUBBER_BAND_FACTOR;
          }
          if (next > maxIndex) {
            next = maxIndex + (next - maxIndex) * RUBBER_BAND_FACTOR;
          }
          pageIndex.value = next;
        })
        .onEnd((e, success) => {
          'worklet';

          if (!success) {
            // Cancelled pan (e.g. stolen by a parent scroll view): must not
            // commit a month change, just spring back to the committed page.
            pageIndex.value = withSpring(curIndexSV.value, PAGE_SPRING_CONFIG);
            return;
          }
          const minIndex = prevDisabledSV.value
            ? curIndexSV.value
            : curIndexSV.value - 1;
          const maxIndex = nextDisabledSV.value
            ? curIndexSV.value
            : curIndexSV.value + 1;
          const target = computeSwipeTarget({
            progress: pageIndex.value,
            velocityX: e.velocityX,
            minIndex,
            maxIndex,
          });
          if (target > curIndexSV.value) {
            // Shift row heights on the UI thread so the height interpolation
            // stays continuous before React re-renders the new window (the
            // true values are re-written in useLayoutEffect after the commit).
            prevRowsSV.value = centerRowsSV.value;
            centerRowsSV.value = nextRowsSV.value;
          } else if (target < curIndexSV.value) {
            nextRowsSV.value = centerRowsSV.value;
            centerRowsSV.value = prevRowsSV.value;
          }
          curIndexSV.value = target;
          pageIndex.value = withSpring(target, PAGE_SPRING_CONFIG);
          // Commit now, not on spring completion: consecutive swipes can
          // chain, and the settled page already shows the target month.
          runOnJS(commitNavigate)(target);
        }),
    [
      pageWidth,
      pageIndex,
      startIndex,
      curIndexSV,
      prevDisabledSV,
      nextDisabledSV,
      prevRowsSV,
      centerRowsSV,
      nextRowsSV,
      commitNavigate,
    ],
  );

  // Animate container height between the (data-derived) heights of the pages
  // as the finger moves, so 4/5/6-row months don't jump at settle time. Reads
  // only shared values, so deps stay empty and the worklet never rebuilds.
  const containerStyle = useAnimatedStyle(() => {
    const offsetFromCenter = pageIndex.value - curIndexSV.value;
    const centerHeight = gridHeight(centerRowsSV.value);
    const neighborHeight =
      offsetFromCenter < 0
        ? gridHeight(prevRowsSV.value)
        : gridHeight(nextRowsSV.value);
    const t = Math.min(Math.abs(offsetFromCenter), 1);
    return {
      height: centerHeight + (neighborHeight - centerHeight) * t,
    };
  }, []);

  const pagerStyle = useMemo(
    () => [pagerClipStyle, containerStyle],
    [containerStyle],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View testID="calendar-month-pager" style={pagerStyle}>
        {pageWidth > 0 ? (
          [curIndex - 1, curIndex, curIndex + 1].map((i) => {
            let calendarIndex = CALENDAR_CURRENT;
            if (i < curIndex) calendarIndex = CALENDAR_PREV;
            if (i > curIndex) calendarIndex = CALENDAR_NEXT;
            return (
              <PagerPage
                key={i}
                index={i}
                pageIndex={pageIndex}
                pageWidth={pageWidth}
                calendarIndex={calendarIndex}
                fullWidth={fullWidth}
              />
            );
          })
        ) : (
          // First frame before the width probe measures the container.
          <MonthDaysGrid
            calendarIndex={CALENDAR_CURRENT}
            hideOutOfMonth={false}
            fullWidth={fullWidth}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export function SwipeableDayGrid({
  calendarIndex,
  fullWidth,
  isPrevDisabled,
  isNextDisabled,
}: ISwipeableDayGridProps) {
  const swipeEnabled = useSwipeMonthNavEnabled();
  const { data } = useDatePickerContext();
  const [pageWidth, setPageWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setPageWidth(e.nativeEvent.layout.width);
  }, []);

  // Guard: the pager needs the prev/next calendars from SWIPE_PAGER_OFFSETS
  // and only drives the primary panel (dual-panel iPad keeps buttons). If the
  // gate and the config ever disagree, degrade to the plain grid instead of
  // rendering empty pages.
  const canSwipe =
    swipeEnabled &&
    calendarIndex === CALENDAR_CURRENT &&
    data.calendars.length >= 3;

  if (!canSwipe) {
    return (
      <DayGrid
        calendarIndex={calendarIndex}
        hideOutOfMonth={false}
        fullWidth={fullWidth}
      />
    );
  }

  return (
    // Nested RNGH root: required for gestures when the sheet renders inside a
    // native modal on Android; harmless otherwise.
    <GestureHandlerRootView style={rootViewStyle}>
      <YStack>
        {/* Zero-height probe: measures width without re-firing while the
            pager's own view is busy animating height during the drag. */}
        <Stack style={widthProbeStyle} onLayout={handleLayout} />
        <WeekdayRow />
        <MonthPager
          pageWidth={pageWidth}
          fullWidth={fullWidth}
          isPrevDisabled={isPrevDisabled}
          isNextDisabled={isNextDisabled}
        />
      </YStack>
    </GestureHandlerRootView>
  );
}
