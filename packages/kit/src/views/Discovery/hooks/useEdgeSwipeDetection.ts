import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';

import { Dimensions } from 'react-native';

import type { ITabContainerRef } from '@onekeyhq/components';

import type { GestureResponderEvent } from 'react-native';

const SWIPE_THRESHOLD = 100;
const DIRECTION_THRESHOLD = 15;

/**
 * Detects horizontal edge swipes on views containing inner PagerViews.
 *
 * Uses React Native raw touch events (onTouchStart/Move/End) as passive
 * listeners. These fire regardless of inner gesture handlers (PagerView,
 * ScrollView) and have no state machine that can get stuck.
 *
 * Reads boundary state from the Tabs.Container ref via getCurrentIndex()
 * at touch start time, avoiding stale closure issues.
 *
 * For pages without inner PagerViews (e.g. Browser), set screenEdgeWidth
 * to require swipes to start near the screen edge.
 */
export function useEdgeSwipeDetection({
  tabsRef,
  tabCount,
  onSwipeLeft,
  onSwipeRight,
  screenEdgeWidth,
}: {
  tabsRef?: RefObject<ITabContainerRef | null>;
  tabCount: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** When set, swipes must start within this distance from screen edge. */
  screenEdgeWidth?: number;
}) {
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeLeftRef.current = onSwipeLeft;
  onSwipeRightRef.current = onSwipeRight;

  const tabCountRef = useRef(tabCount);
  tabCountRef.current = tabCount;

  const tabsRefRef = useRef(tabsRef);
  tabsRefRef.current = tabsRef;

  const screenEdgeWidthRef = useRef(screenEdgeWidth);
  screenEdgeWidthRef.current = screenEdgeWidth;

  // Touch tracking state (plain refs, runs on JS thread)
  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const isVertical = useRef(false);
  const decided = useRef(false);
  const wasAtFirstTab = useRef(false);
  const wasAtLastTab = useRef(false);
  const isNearEdge = useRef(false);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    startX.current = pageX;
    startY.current = pageY;
    lastX.current = pageX;
    isVertical.current = false;
    decided.current = false;

    // Read boundary state from ref at touch start
    const currentIndex = tabsRefRef.current?.current?.getCurrentIndex() ?? 0;
    wasAtFirstTab.current = currentIndex === 0;
    wasAtLastTab.current = currentIndex >= tabCountRef.current - 1;

    // Check if touch started near screen edge
    const edgeW = screenEdgeWidthRef.current;
    if (edgeW !== null && edgeW !== undefined) {
      const screenWidth = Dimensions.get('window').width;
      isNearEdge.current = pageX < edgeW || pageX > screenWidth - edgeW;
    } else {
      isNearEdge.current = true;
    }
  }, []);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY } = e.nativeEvent;
    lastX.current = pageX;

    if (!decided.current) {
      const dx = Math.abs(pageX - startX.current);
      const dy = Math.abs(pageY - startY.current);

      if (dy > DIRECTION_THRESHOLD && dy > dx) {
        isVertical.current = true;
        decided.current = true;
      } else if (dx > DIRECTION_THRESHOLD) {
        decided.current = true;
      }
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isVertical.current && decided.current && isNearEdge.current) {
      const dx = lastX.current - startX.current;

      // Left swipe at right boundary → switch to next outer tab
      if (
        wasAtLastTab.current &&
        dx < -SWIPE_THRESHOLD &&
        onSwipeLeftRef.current
      ) {
        onSwipeLeftRef.current();
      }

      // Right swipe at left boundary → switch to prev outer tab
      else if (
        wasAtFirstTab.current &&
        dx > SWIPE_THRESHOLD &&
        onSwipeRightRef.current
      ) {
        onSwipeRightRef.current();
      }
    }
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
