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
export function useFixedColumnShadow({
  position,
  enabled = true,
  initialVisible = false,
}: IUseFixedColumnShadowOptions): IUseFixedColumnShadowResult {
  const [showShadow, setShowShadow] = useState(initialVisible);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  // Get underlying DOM element from ScrollView (web/desktop only)
  const getScrollElement = useCallback((): HTMLElement | null => {
    if (platformEnv.isNative) return null;
    const ref = scrollViewRef.current;
    if (!ref) return null;
    const scrollableNode = ref.getScrollableNode?.();
    return scrollableNode instanceof HTMLElement ? scrollableNode : null;
  }, []);

  // Check shadow visibility based on scroll position for web
  const handleWebScroll = useCallback(() => {
    const element = getScrollElement();
    if (!element) return;

    const { scrollWidth, clientWidth } = element;
    // Show shadow when content is scrollable (content wider than container)
    const needsScroll = scrollWidth > clientWidth + 1;

    setShowShadow((prev) => (prev !== needsScroll ? needsScroll : prev));
  }, [getScrollElement]);

  // Handle scroll event for native platforms
  const handleNativeScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentSize, layoutMeasurement } = event.nativeEvent;
      // Show shadow when content is scrollable (content wider than container)
      const needsScroll = contentSize.width > layoutMeasurement.width + 1;

      setShowShadow((prev) => (prev !== needsScroll ? needsScroll : prev));
    },
    [],
  );

  // Setup ResizeObserver for web/desktop to handle container resize
  useEffect(() => {
    if (!enabled || platformEnv.isNative) return;
    if (typeof ResizeObserver === 'undefined') return;

    const element = getScrollElement();
    if (!element) return;

    handleWebScroll();
    const resizeObserver = new ResizeObserver(handleWebScroll);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [enabled, handleWebScroll, getScrollElement]);

  return {
    showShadow,
    scrollViewRef,
    handleNativeScroll,
    handleWebScroll,
  };
}

// Shadow style constants for consistent theming across components
export const SHADOW_CONSTANTS = {
  /** Shadow blur and spread radius in pixels */
  SHADOW_SIZE: 12,
  /** Web shadow opacity for light theme */
  WEB_SHADOW_OPACITY_LIGHT: 0.15,
  /** Web shadow opacity for dark theme */
  WEB_SHADOW_OPACITY_DARK: 0.1,
  /** Native gradient opacity for light theme */
  NATIVE_GRADIENT_OPACITY_LIGHT: 0.12,
  /** Native gradient opacity for dark theme */
  NATIVE_GRADIENT_OPACITY_DARK: 0.1,
  /** Transition duration for shadow animation */
  TRANSITION_DURATION: '0.2s',
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
  const color = isDark
    ? `rgba(255, 255, 255, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;

  return position === 'left'
    ? `${size}px 0 ${size}px ${color}`
    : `-${size}px 0 ${size}px ${color}`;
}

/**
 * Get clip-path style for web shadow clipping
 */
export function getWebClipPath(position: IShadowPosition): string {
  const size = SHADOW_CONSTANTS.SHADOW_SIZE + 8; // Extra padding for shadow
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
