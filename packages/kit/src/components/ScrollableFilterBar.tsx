import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { ScrollView } from 'react-native';

import {
  GradientMask,
  ScrollGuard,
  Stack,
  XStack,
  useStyle,
} from '@onekeyhq/components';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView as ScrollViewType,
} from 'react-native';
import type { SpaceTokens } from 'tamagui';

// ---------------------------------------------------------------------------
//  Context – lets children register their layout so the bar can scroll to them
// ---------------------------------------------------------------------------

interface IScrollableFilterBarContext {
  handleItemLayout: (id: string, event: LayoutChangeEvent) => void;
}

const ScrollableFilterBarContext =
  createContext<IScrollableFilterBarContext | null>(null);

/**
 * Hook for child items to register their layout position.
 * Must be used inside a `<ScrollableFilterBar>`.
 */
function useScrollableFilterBar() {
  const ctx = useContext(ScrollableFilterBarContext);
  if (!ctx) {
    throw new OneKeyInternalError(
      'useScrollableFilterBar must be used within <ScrollableFilterBar>',
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
//  Layout constants
// ---------------------------------------------------------------------------

const DEFAULT_LAYOUT_CONSTANTS = {
  SCROLL_OFFSET_ADJUSTMENT: 4,
  LEFT_GRADIENT_THRESHOLD: 2,
} as const;

const AUTO_SCROLL_DELAY_MS = 100;
const EMPTY_STYLE: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

interface IScrollableFilterBarProps {
  /** When this value changes the bar auto-scrolls to keep the item visible. */
  selectedItemId?: string;
  /** Gap token between items inside the scrollable area. */
  itemGap?: SpaceTokens;
  /** Right-padding token inside the scrollable area (prevents last item being hidden behind the gradient). */
  itemPr?: SpaceTokens;
  /** Forwarded to `<ScrollView contentContainerStyle>`. Accepts Tamagui StackProps (resolved via useStyle). */
  contentContainerStyle?: Record<string, unknown>;
  /** Layout constants for scroll positioning. */
  layoutConstants?: {
    SCROLL_OFFSET_ADJUSTMENT: number;
    LEFT_GRADIENT_THRESHOLD: number;
  };
  children: ReactNode;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

function ScrollableFilterBarImpl({
  selectedItemId,
  itemGap,
  itemPr,
  contentContainerStyle,
  layoutConstants: layoutConstantsProp,
  children,
}: IScrollableFilterBarProps) {
  const layoutConstants = layoutConstantsProp ?? DEFAULT_LAYOUT_CONSTANTS;

  const resolvedContentContainerStyle = useStyle(
    contentContainerStyle ?? EMPTY_STYLE,
    {
      resolveValues: 'auto',
    },
  );

  // ---- scroll state ----
  const [scrollX, setScrollX] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const scrollViewRef = useRef<ScrollViewType>(null);
  const itemLayoutsRef = useRef<Record<string, { x: number; width: number }>>(
    {},
  );

  // ---- gradient visibility ----
  const shouldShowLeftGradient = useMemo(
    () => scrollX > layoutConstants.LEFT_GRADIENT_THRESHOLD,
    [scrollX, layoutConstants.LEFT_GRADIENT_THRESHOLD],
  );

  const shouldShowRightGradient = useMemo(
    () =>
      contentWidth > scrollViewWidth &&
      scrollX <
        contentWidth -
          scrollViewWidth -
          layoutConstants.LEFT_GRADIENT_THRESHOLD,
    [
      contentWidth,
      scrollViewWidth,
      scrollX,
      layoutConstants.LEFT_GRADIENT_THRESHOLD,
    ],
  );

  // ---- handlers ----
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setScrollViewWidth((prev) => (prev === width ? prev : width));
  }, []);

  const handleContentSizeChange = useCallback((width: number) => {
    setContentWidth((prev) => (prev === width ? prev : width));
  }, []);

  const handleItemLayout = useCallback(
    (id: string, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      itemLayoutsRef.current[id] = { x, width };
    },
    [],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollX(event.nativeEvent.contentOffset.x);
    },
    [],
  );

  // ---- auto-scroll to selected item ----
  const scrollToItem = useCallback(
    (itemId: string) => {
      const layout = itemLayoutsRef.current[itemId];
      if (!layout || !scrollViewRef.current || scrollViewWidth === 0) {
        return;
      }
      const maxScrollX = Math.max(0, contentWidth - scrollViewWidth);
      const itemStart = Math.max(
        0,
        layout.x - layoutConstants.SCROLL_OFFSET_ADJUSTMENT,
      );
      const targetX = Math.max(0, Math.min(itemStart, maxScrollX));

      scrollViewRef.current.scrollTo({ x: targetX, animated: true });
    },
    [contentWidth, scrollViewWidth, layoutConstants.SCROLL_OFFSET_ADJUSTMENT],
  );

  useEffect(() => {
    if (selectedItemId) {
      // Small delay to ensure layout is measured, matching Market's existing pattern
      const timer = setTimeout(() => {
        scrollToItem(selectedItemId);
      }, AUTO_SCROLL_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [selectedItemId, scrollToItem]);

  // ---- context value ----
  const ctxValue = useMemo<IScrollableFilterBarContext>(
    () => ({ handleItemLayout }),
    [handleItemLayout],
  );

  return (
    <ScrollableFilterBarContext.Provider value={ctxValue}>
      <ScrollGuard>
        <Stack position="relative" width="100%" overflow="hidden">
          <ScrollView
            horizontal
            ref={scrollViewRef}
            bounces={false}
            contentContainerStyle={resolvedContentContainerStyle}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onLayout={handleLayout}
            onContentSizeChange={handleContentSizeChange}
          >
            <XStack gap={itemGap} pr={itemPr}>
              {children}
            </XStack>
          </ScrollView>

          <GradientMask
            opacity={shouldShowLeftGradient ? 1 : 0}
            position="left"
          />
          <GradientMask
            opacity={shouldShowRightGradient ? 1 : 0}
            position="right"
          />
        </Stack>
      </ScrollGuard>
    </ScrollableFilterBarContext.Provider>
  );
}

const ScrollableFilterBar = memo(ScrollableFilterBarImpl);

export { ScrollableFilterBar, useScrollableFilterBar };
export type { IScrollableFilterBarProps };
