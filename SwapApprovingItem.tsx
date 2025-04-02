import React, { useCallback, useRef } from 'react';

import { Animated } from 'react-native';

const progressAnim = useRef(new Animated.Value(0)).current;

const startProgress = useCallback(
  (duration?: number) => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration || 1000 * estTime,
      useNativeDriver: false,
    }).start(onComplete);
  },
  [estTime, onComplete],
);

const revertProgress = useCallback(
  (duration?: number) => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: duration || 1000 * estTime,
      useNativeDriver: false,
    }).start();
  },
  [estTime],
);

const completeProgress = useCallback(() => {
  Animated.timing(progressAnim, {
    toValue: 1,
    duration: 0,
    useNativeDriver: false,
  }).start(onComplete);
}, [onComplete]);

return (
  <Animated.View
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, containerWidth],
      }),
      backgroundColor: '#44D62C80',
      opacity: 0.2,
    }}
  />
);
