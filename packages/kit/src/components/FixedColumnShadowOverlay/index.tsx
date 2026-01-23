import { LinearGradient, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  type IShadowPosition,
  SHADOW_CONSTANTS,
  getNativeShadowGradientColors,
} from '../../hooks/useFixedColumnShadow';

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
