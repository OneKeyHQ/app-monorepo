import { useMemo } from 'react';

import { Stack } from '@onekeyhq/components/src/primitives/Stack';
import { useTheme } from '@onekeyhq/components/src/shared/tamagui';

import { LinearGradient } from '../../content/LinearGradient';

type IGradientMaskPosition = 'left' | 'right';

interface IGradientMaskProps {
  position: IGradientMaskPosition;
  opacity?: number;
  width?: number;
  bgColor?: string;
}

const animateOnlyProps = ['opacity', 'width'];
const START_LEFT: [number, number] = [0, 0];
const START_RIGHT: [number, number] = [1, 0];
const END_LEFT: [number, number] = [1, 0];
const END_RIGHT: [number, number] = [0, 0];

export function GradientMask({
  position,
  opacity = 1,
  width = 20,
  bgColor,
}: IGradientMaskProps) {
  const theme = useTheme();
  const positionProps = position === 'left' ? { left: 0 } : { right: 0 };

  const baseColor = bgColor || theme.bgApp.val;
  const colors = useMemo(() => [baseColor, `${baseColor}00`], [baseColor]);

  return (
    <Stack
      overflow="hidden"
      position="absolute"
      top={0}
      bottom={0}
      width={opacity ? width : 0}
      zIndex={9}
      pointerEvents="none"
      opacity={opacity}
      animation="fast"
      animateOnly={animateOnlyProps}
      {...positionProps}
    >
      <LinearGradient
        width="100%"
        height="100%"
        colors={colors}
        start={position === 'left' ? START_LEFT : START_RIGHT}
        end={position === 'left' ? END_LEFT : END_RIGHT}
      />
    </Stack>
  );
}
