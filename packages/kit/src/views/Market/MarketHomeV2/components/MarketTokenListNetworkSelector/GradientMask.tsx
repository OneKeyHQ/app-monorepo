import { LinearGradient, Stack, useTheme } from '@onekeyhq/components';

interface IGradientMaskProps {
  position: 'left' | 'right';
  opacity?: number;
}

export const GradientMask = ({ position, opacity = 1 }: IGradientMaskProps) => {
  const theme = useTheme();
  const positionProps = position === 'left' ? { left: 0 } : { right: 0 };

  return (
    <Stack
      overflow="hidden"
      position="absolute"
      top={0}
      bottom={0}
      width={opacity ? 20 : 0}
      zIndex={9}
      pointerEvents="none"
      opacity={opacity}
      animation="fast"
      animateOnly={['opacity', 'width']}
      {...positionProps}
    >
      <LinearGradient
        width="100%"
        height="100%"
        colors={[theme.bgApp.val, `${theme.bgApp.val}00`]}
        start={position === 'left' ? [0, 0] : [1, 0]}
        end={position === 'left' ? [1, 0] : [0, 0]}
      />
    </Stack>
  );
};
