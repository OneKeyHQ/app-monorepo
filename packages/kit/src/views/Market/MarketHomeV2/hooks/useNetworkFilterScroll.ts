import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView as ScrollViewType,
} from 'react-native';

// Default layout constants for network filter scrolling
const DEFAULT_LAYOUT_CONSTANTS = {
  SCROLL_OFFSET_ADJUSTMENT: 4,
  LEFT_GRADIENT_THRESHOLD: 2,
} as const;

interface IUseNetworkFilterScrollOptions {
  layoutConstants?: {
    SCROLL_OFFSET_ADJUSTMENT: number;
    LEFT_GRADIENT_THRESHOLD: number;
  };
  enableMoreButton?: boolean;
  moreButtonWidth?: number;
}

interface IUseNetworkFilterScrollReturn {
  // State
  scrollX: number;
  scrollViewWidth: number;
  contentWidth: number;

  // Refs
  scrollViewRef: React.RefObject<ScrollViewType | null>;
  itemLayoutsRef: {
    current: Record<string, { x: number; width: number }>;
  };

  // Computed
  shouldShowLeftGradient: boolean;
  shouldShowRightGradient: boolean;
  allowMoreButton: boolean;
  adjustedContentWidth: number;

  // Handlers
  handleLayout: (event: LayoutChangeEvent) => void;
  handleContentSizeChange: (width: number) => void;
  handleItemLayout: (networkId: string, event: LayoutChangeEvent) => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

  // Methods
  scrollToNetwork: (networkId: string) => void;
}

/**
 * Custom hook for managing network filter scroll behavior
 * Handles scroll state, gradient masks, and scroll-to-network functionality
 *
 * @param options - Configuration options for the hook
 * @returns State, handlers, and methods for network filter scrolling
 */
export function useNetworkFilterScroll(
  options: IUseNetworkFilterScrollOptions = {},
): IUseNetworkFilterScrollReturn {
  const {
    layoutConstants = DEFAULT_LAYOUT_CONSTANTS,
    enableMoreButton = false,
    moreButtonWidth = 0,
  } = options;

  // State management
  const [scrollX, setScrollX] = useState(0);
  const [scrollViewWidth, setScrollViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  // Refs
  const scrollViewRef = useRef<ScrollViewType>(null);
  const itemLayoutsRef = useRef<Record<string, { x: number; width: number }>>(
    {},
  );

  // Computed values
  const shouldShowLeftGradient = useMemo(() => {
    return scrollX > layoutConstants.LEFT_GRADIENT_THRESHOLD;
  }, [scrollX, layoutConstants.LEFT_GRADIENT_THRESHOLD]);

  const allowMoreButton = useMemo(() => {
    return enableMoreButton && contentWidth > scrollViewWidth;
  }, [enableMoreButton, contentWidth, scrollViewWidth]);

  const adjustedContentWidth = useMemo(() => {
    return allowMoreButton ? contentWidth + moreButtonWidth : contentWidth;
  }, [allowMoreButton, contentWidth, moreButtonWidth]);

  const shouldShowRightGradient = useMemo(() => {
    return (
      adjustedContentWidth > scrollViewWidth &&
      scrollX <
        adjustedContentWidth -
          scrollViewWidth -
          layoutConstants.LEFT_GRADIENT_THRESHOLD
    );
  }, [
    adjustedContentWidth,
    scrollViewWidth,
    scrollX,
    layoutConstants.LEFT_GRADIENT_THRESHOLD,
  ]);

  // Event handlers
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      setScrollViewWidth((prevWidth) =>
        prevWidth === width ? prevWidth : width,
      );
    },
    [setScrollViewWidth],
  );

  const handleContentSizeChange = useCallback(
    (width: number) => {
      setContentWidth((prevWidth) => (prevWidth === width ? prevWidth : width));
    },
    [setContentWidth],
  );

  const handleItemLayout = useCallback(
    (networkId: string, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      itemLayoutsRef.current[networkId] = { x, width };
    },
    [],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollX = event.nativeEvent.contentOffset.x;
      setScrollX(currentScrollX);
    },
    [],
  );

  // Scroll control method
  const scrollToNetwork = useCallback(
    (networkId: string) => {
      const layout = itemLayoutsRef.current[networkId];
      if (!layout || !scrollViewRef.current || scrollViewWidth === 0) {
        return;
      }

      const maxScrollX = Math.max(0, adjustedContentWidth - scrollViewWidth);
      const itemStart = Math.max(
        0,
        layout.x - layoutConstants.SCROLL_OFFSET_ADJUSTMENT,
      );
      const targetX = Math.max(0, Math.min(itemStart, maxScrollX));

      scrollViewRef.current.scrollTo({
        x: targetX,
        animated: true,
      });
    },
    [
      adjustedContentWidth,
      scrollViewWidth,
      layoutConstants.SCROLL_OFFSET_ADJUSTMENT,
    ],
  );

  return {
    // State
    scrollX,
    scrollViewWidth,
    contentWidth,

    // Refs
    scrollViewRef,
    itemLayoutsRef,

    // Computed
    shouldShowLeftGradient,
    shouldShowRightGradient,
    allowMoreButton,
    adjustedContentWidth,

    // Handlers
    handleLayout,
    handleContentSizeChange,
    handleItemLayout,
    handleScroll,

    // Methods
    scrollToNetwork,
  };
}
