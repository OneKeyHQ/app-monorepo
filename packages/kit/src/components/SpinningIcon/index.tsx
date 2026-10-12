import { useEffect, useMemo } from 'react';

import { Animated, Easing } from 'react-native';

import { Icon } from '@onekeyhq/components';
import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';

const SPIN_DURATION_MS = 800;

// Rotates an icon in place while `spinning`. The glyph stays the same and the
// icon always completes the turn it is on, so it comes to rest upright rather
// than snapping back mid-spin. Plain RN Animated so the loop runs on every
// target (reanimated repeat loops do not run on web).
export function SpinningIcon({
  name,
  spinning,
  size = '$4',
  color,
}: {
  name: IKeyOfIcons;
  spinning: boolean;
  size?: IIconProps['size'];
  color?: IIconProps['color'];
}) {
  const rotation = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (!spinning) return undefined;
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    return () => {
      rotation.stopAnimation((value: number) => {
        Animated.timing(rotation, {
          toValue: 1,
          duration: (1 - value) * SPIN_DURATION_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(({ finished }) => {
          // An interrupted finish means a new spin took over; leave it be.
          if (finished) rotation.setValue(0);
        });
      });
    };
  }, [rotation, spinning]);
  const style = useMemo(
    () => ({
      transform: [
        {
          rotate: rotation.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [rotation],
  );
  return (
    <Animated.View style={style}>
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  );
}
