import { useCallback, useEffect, useRef, useState } from 'react';

import type { ScrollView } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export type IShadowPosition = 'left' | 'right';

export interface IUseFixedColumnShadowOptions {
  /** Position of the fixed column: 'left' shows shadow when scrolled right, 'right' shows shadow when scrolled left */
  position: IShadowPosition;
  /** Whether shadow management is enabled */
  enabled?: boolean;
  /** Initial shadow visibility state */
  initialVisible?: boolean;
}

export interface IUseFixedColumnShadowResult {
  /** Whether the shadow should be visible */
  showShadow: boolean;
  /** Ref to attach to the ScrollView */
  scrollViewRef: React.RefObject<React.ElementRef<typeof ScrollView> | null>;
  /** Scroll handler for native platforms */
  handleNativeScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Scroll handler for web platforms */
  handleWebScroll: () => void;
}

/**
 * Hook for managing fixed column shadow visibility based on scroll position.
 * Supports both web (ResizeObserver + scroll events) and native (scroll events) platforms.
 *
 * @param options Configuration options
 * @returns Shadow state and handlers
 *
 * @example
 * // For left-fixed column (shadow appears when content is scrolled right)
 * const { showShadow, scrollViewRef, handleNativeScroll, handleWebScroll } =
 *   useFixedColumnShadow({ position: 'left' });
 *
 * // For right-fixed column (shadow appears when content is scrolled left from end)
 * const { showShadow, scrollViewRef, handleNativeScroll, handleWebScroll } =
 *   useFixedColumnShadow({ position: 'right', initialVisible: true });
 */
const SCROLL_THRESHOLD = 1;

/**
 * Calculate shadow visibility based on scroll position
 */
function calculateShadowVisibility(
  position: IShadowPosition,
  scrollOffset: number,
  scrollWidth: number,
  clientWidth: number,
): boolean {
  if (position === 'left') {
    return scrollOffset > SCROLL_THRESHOLD;
  }
  const maxScrollLeft = scrollWidth - clientWidth;
  return scrollOffset < maxScrollLeft - SCROLL_THRESHOLD;
}

const MOBILE_BREAKPOINT = 768;

export function useFixedColumnShadow({
  position,
  enabled = true,
  initialVisible = false,
}: IUseFixedColumnShadowOptions): IUseFixedColumnShadowResult {
  const isNative = platformEnv.isNative;
  const isMobileWeb =
    !isNative &&
    typeof globalThis !== 'undefined' &&
    'innerWidth' in globalThis &&
    (globalThis as unknown as Window).innerWidth <= MOBILE_BREAKPOINT;

  // Force shadow visible on mobile devices (Native App or mobile browser width <= 768px)
  const forceVisible = (isNative || isMobileWeb) && enabled;

  const [showShadow, setShowShadow] = useState(initialVisible);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const getScrollElement = useCallback((): HTMLElement | null => {
    if (isNative) return null;
    const ref = scrollViewRef.current;
    if (!ref) return null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- getScrollableNode is a web-only RN method not in types
    const scrollableNode = ref.getScrollableNode?.();
    return scrollableNode instanceof HTMLElement ? scrollableNode : null;
  }, [isNative]);

  const handleWebScroll = useCallback(() => {
    if (forceVisible) return;

    const element = getScrollElement();
    if (!element) return;

    const { scrollWidth, clientWidth, scrollLeft } = element;
    const needsScroll = scrollWidth > clientWidth + SCROLL_THRESHOLD;

    setShowShadow(
      needsScroll
        ? calculateShadowVisibility(
            position,
            scrollLeft,
            scrollWidth,
            clientWidth,
          )
        : false,
    );
  }, [getScrollElement, forceVisible, position]);

  const handleNativeScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (forceVisible) return;

      const { contentSize, layoutMeasurement, contentOffset } =
        event.nativeEvent;
      const needsScroll =
        contentSize.width > layoutMeasurement.width + SCROLL_THRESHOLD;

      setShowShadow(
        needsScroll
          ? calculateShadowVisibility(
              position,
              contentOffset.x,
              contentSize.width,
              layoutMeasurement.width,
            )
          : false,
      );
    },
    [forceVisible, position],
  );

  // Web ResizeObserver setup
  useEffect(() => {
    if (!enabled || isNative || forceVisible) return;
    if (typeof ResizeObserver === 'undefined') return;

    const element = getScrollElement();
    if (!element) return;

    handleWebScroll();
    const resizeObserver = new ResizeObserver(handleWebScroll);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [enabled, handleWebScroll, getScrollElement, isNative, forceVisible]);

  return {
    showShadow: forceVisible || showShadow,
    scrollViewRef,
    handleNativeScroll,
    handleWebScroll,
  };
}

// Shadow style constants for consistent theming across components
export const SHADOW_CONSTANTS = {
  /** Shadow blur and spread radius in pixels */
  SHADOW_SIZE: 4,
  /** Web shadow opacity for light theme */
  WEB_SHADOW_OPACITY_LIGHT: 0.06,
  /** Web shadow opacity for dark theme */
  WEB_SHADOW_OPACITY_DARK: 0.04,
  /** Native gradient opacity for light theme */
  NATIVE_GRADIENT_OPACITY_LIGHT: 0.05,
  /** Native gradient opacity for dark theme */
  NATIVE_GRADIENT_OPACITY_DARK: 0.04,
  /** Transition duration for shadow animation */
  TRANSITION_DURATION: '0.2s',
  /** Simple shadow overlay opacity for light theme (used in mobile edge overlay) */
  SIMPLE_SHADOW_OPACITY_LIGHT: 0.1,
  /** Simple shadow overlay opacity for dark theme (used in mobile edge overlay) */
  SIMPLE_SHADOW_OPACITY_DARK: 0.15,
} as const;

/**
 * Get CSS box-shadow style for web platforms
 */
export function getWebShadowStyle(
  position: IShadowPosition,
  isDark: boolean,
): string {
  const opacity = isDark
    ? SHADOW_CONSTANTS.WEB_SHADOW_OPACITY_DARK
    : SHADOW_CONSTANTS.WEB_SHADOW_OPACITY_LIGHT;
  const size = SHADOW_CONSTANTS.SHADOW_SIZE;
  const blur = size; // Use same size for blur to keep shadow narrow
  const color = isDark
    ? `rgba(255, 255, 255, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;

  return position === 'left'
    ? `${size}px 0 ${blur}px ${color}`
    : `-${size}px 0 ${blur}px ${color}`;
}

/**
 * Get clip-path style for web shadow clipping
 */
export function getWebClipPath(position: IShadowPosition): string {
  const size = SHADOW_CONSTANTS.SHADOW_SIZE + 4; // Extra padding for shadow (reduced since shadow is narrower)
  return position === 'left'
    ? `inset(0 -${size}px 0 0)`
    : `inset(0 0 0 -${size}px)`;
}

/**
 * Get gradient colors for native shadow overlay
 */
export function getNativeShadowGradientColors(
  position: IShadowPosition,
  isDark: boolean,
): [string, string] {
  const opacity = isDark
    ? SHADOW_CONSTANTS.NATIVE_GRADIENT_OPACITY_DARK
    : SHADOW_CONSTANTS.NATIVE_GRADIENT_OPACITY_LIGHT;
  const shadowColor = isDark
    ? `rgba(255, 255, 255, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;
  const transparent = isDark ? 'rgba(255, 255, 255, 0)' : 'rgba(0, 0, 0, 0)';

  // For left-fixed column, shadow fades to the right
  // For right-fixed column, shadow fades to the left
  return position === 'left'
    ? [shadowColor, transparent]
    : [transparent, shadowColor];
}
