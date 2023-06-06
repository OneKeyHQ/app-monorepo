import type { ComponentProps, FC, PropsWithChildren } from 'react';

import { MotiPressable } from 'moti/interactions';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Button } from '@onekeyhq/components';

export const AnimatedButton = Animated.createAnimatedComponent(Button);

export interface HoverContainerProps {
  hoverButtonProps: ComponentProps<typeof Button>;
}
const HoverContainer: FC<PropsWithChildren<HoverContainerProps>> = ({
  children,
  hoverButtonProps,
}) => {
  const isHovered = useSharedValue(false);
  const showButtonStyle = useAnimatedStyle(
    () => ({
      display: isHovered.value ? 'flex' : 'none',
      opacity: isHovered.value ? 1 : 0,
    }),
    [],
  );

  return (
    <MotiPressable hoveredValue={isHovered}>
      {children}
      <AnimatedButton style={showButtonStyle} {...hoverButtonProps} />
    </MotiPressable>
  );
};

export default HoverContainer;
