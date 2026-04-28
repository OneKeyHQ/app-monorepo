import { useEffect } from 'react';
import type { ComponentProps } from 'react';

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';

const ROTATE_DURATION_MS = 900;

type IRotatingLoaderProps = Omit<ComponentProps<typeof Icon>, 'name'> & {
  name?: IKeyOfIcons;
};

export function RotatingLoader({
  name = 'LoaderOutline',
  ...rest
}: IRotatingLoaderProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: ROTATE_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Icon name={name} {...rest} />
    </Animated.View>
  );
}
