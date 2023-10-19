/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import { Easing } from 'react-native';

import type {
  StackCardStyleInterpolator,
  TransitionPreset,
} from '@react-navigation/stack/lib/typescript/src/types';

export const extAnimConfig: {
  transition: Omit<
    TransitionPreset,
    'cardStyleInterpolator' | 'gestureDirection' | 'headerStyleInterpolator'
  >;
  openModalAnim: {
    cardStyleInterpolator: StackCardStyleInterpolator;
  };
  stackScreenAnim: {
    cardStyleInterpolator: StackCardStyleInterpolator;
  };
} = {
  transition: {
    transitionSpec: {
      open: {
        animation: 'timing',
        config: {
          duration: 150,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        },
      },
      close: {
        animation: 'timing',
        config: {
          duration: 150,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        },
      },
    },
  },

  openModalAnim: {
    cardStyleInterpolator: ({ current }: { current: any }) => ({
      cardStyle: {
        transform: [
          {
            translateY: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
              extrapolate: 'clamp',
            }),
          },
        ],
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        }),
      },
    }),
  },

  stackScreenAnim: {
    cardStyleInterpolator: ({ current }: { current: any }) => ({
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
              extrapolate: 'clamp',
            }),
          },
        ],
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        }),
      },
    }),
  },
};
