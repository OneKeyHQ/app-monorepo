import { createAnimations } from '@tamagui/animations-reanimated';
import { Easing } from 'react-native-reanimated';

export const animations = createAnimations({
  '0ms': {
    type: 'timing',
    duration: 0,
  },
  '50ms': {
    type: 'timing',
    duration: 50,
  },
  '100ms': {
    type: 'timing',
    duration: 100,
  },
  repeat: {
    type: 'timing',
    duration: 300,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 0.1,
    stiffness: 100,
  },
  popoverQuick: {
    type: 'timing',
    duration: 150,
    easing: Easing.out(Easing.cubic),
  },
  smooth: {
    type: 'spring',
    mass: 1,
    stiffness: 438,
    damping: 42,
  },
  fast: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  slow: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  switch: {
    type: 'spring',
    damping: 30,
    mass: 1,
    stiffness: 300,
  },
});
