import { LinearGradient, Stack } from '@onekeyhq/components';

interface IGradientMaskProps {
  position: 'left' | 'right';
}

export const GradientMask = ({ position }: IGradientMaskProps) => {
  const positionProps = position === 'left' ? { left: 20 } : { right: 20 };

  return (
    <Stack
      position="absolute"
      top={0}
      bottom={0}
      width={20}
      zIndex={9}
      pointerEvents="none"
      {...positionProps}
    >
      <LinearGradient
        width={20}
        height="100%"
        colors={['$bgApp', 'transparent']}
        start={position === 'left' ? [0, 0] : [1, 0]}
        end={position === 'left' ? [1, 0] : [0, 0]}
      />
    </Stack>
  );
};
