import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { CLOSE_THRESHOLD, SPRING_CONFIG } from '../assets/config';

import type { SwipeGestureProps } from '../assets/types';

const SwipeGesture = ({
  children,
  selectedCard,
  swipeY,
  inTransition,
}: SwipeGestureProps) => {
  const gesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((_, state) => {
      if (selectedCard.value !== -1) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onBegin(() => {
      inTransition.value = 0;
    })
    .onUpdate((e) => {
      if (!inTransition.value) {
        if (e.translationY > CLOSE_THRESHOLD) {
          inTransition.value = 1;
          selectedCard.value = -1;
        } else if (e.translationY >= 0) {
          swipeY.value = e.translationY;
        }
      }
    })
    .onTouchesUp(() => {
      inTransition.value = withDelay(100, withTiming(0, { duration: 0 }));
    })
    .onEnd((e) => {
      if (!inTransition.value && e.translationY <= CLOSE_THRESHOLD) {
        swipeY.value = withSpring(0, SPRING_CONFIG.SWIPE);
      } else {
        swipeY.value = 0;
      }
    });

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
};

export default SwipeGesture;
