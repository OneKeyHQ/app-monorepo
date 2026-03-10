import { LinearGradient, Stack } from '@onekeyhq/components';
import {
  type IShadowPosition,
  SHADOW_CONSTANTS,
  getNativeShadowGradientColors,
} from '@onekeyhq/kit/src/hooks/useFixedColumnShadow';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface ISimpleEdgeShadowOverlayProps {
  /** Whether dark theme is active */
  isDark: boolean;
  /** Position of the edge shadow: 'left' or 'right' */
  position?: 'left' | 'right';
  /** Custom z-index value */
  zIndex?: number;
}

/**
 * Simple edge shadow overlay for mobile native platforms.
 * A thin vertical line shadow at the edge of the container.
 *
 * @example
 * <SimpleEdgeShadowOverlay isDark={isDark} position="right" />
 */
export function SimpleEdgeShadowOverlay({
  isDark,
  position = 'right',
  zIndex = 1,
}: ISimpleEdgeShadowOverlayProps) {
  if (!platformEnv.isNative) {
    return null;
  }

  const opacity = isDark
    ? SHADOW_CONSTANTS.SIMPLE_SHADOW_OPACITY_DARK
    : SHADOW_CONSTANTS.SIMPLE_SHADOW_OPACITY_LIGHT;
  const bg = `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`;
  const positionStyle = position === 'left' ? { left: 0 } : { right: 0 };

  return (
    <Stack
      position="absolute"
      top={0}
      bottom={0}
      width={1}
      zIndex={zIndex}
      pointerEvents="none"
      bg={bg}
      {...positionStyle}
    />
  );
}

interface IFixedColumnShadowOverlayProps {
  /** Position of the fixed column */
  position: IShadowPosition;
  /** Whether the shadow should be visible */
  visible: boolean;
  /** Whether dark theme is active */
  isDark: boolean;
}

/**
 * Native shadow overlay component using LinearGradient.
 * Only renders on native platforms when visible is true.
 *
 * @example
 * <FixedColumnShadowOverlay
 *   position="left"
 *   visible={showShadow}
 *   isDark={isDark}
 * />
 */
export function FixedColumnShadowOverlay({
  position,
  visible,
  isDark,
}: IFixedColumnShadowOverlayProps) {
  // Only render on native platforms when shadow is visible
  if (!platformEnv.isNative || !visible) {
    return null;
  }

  const shadowSize = SHADOW_CONSTANTS.SHADOW_SIZE;
  const colors = getNativeShadowGradientColors(position, isDark);

  const positionStyle =
    position === 'left' ? { right: -shadowSize } : { left: -shadowSize };

  return (
    <Stack
      position="absolute"
      top={0}
      bottom={0}
      width={shadowSize}
      zIndex={1}
      pointerEvents="none"
      {...positionStyle}
    >
      <LinearGradient
        width="100%"
        height="100%"
        colors={colors}
        start={[0, 0]}
        end={[1, 0]}
      />
    </Stack>
  );
}
