import { useCallback, useEffect, useState } from 'react';

import { Animated } from 'react-native';

export const useAnimation = ({
  doAnimation,
  duration,
  loop,
  useNativeDriver,
}: {
  doAnimation: boolean;
  duration: number;
  loop?: boolean;
  useNativeDriver?: boolean;
}) => {
  const [animation] = useState(new Animated.Value(0));

  const anim = useCallback(
    () =>
      Animated.timing(animation, {
        useNativeDriver: useNativeDriver ?? false,
        toValue: doAnimation ? 1 : 0,
        duration,
      }),
    [animation, doAnimation, duration, useNativeDriver],
  );

  useEffect(() => {
    if (loop) {
      Animated.loop(anim()).start();
    } else {
      anim().start();
    }
  }, [anim, loop]);

  return animation;
};
