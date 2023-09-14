/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { TransitionPresets } from '@react-navigation/stack';
import { isNil } from 'lodash';
import { Easing } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { RouteProp } from '@react-navigation/core';
import type { StackNavigationOptions } from '@react-navigation/stack';
import type {
  StackCardStyleInterpolator,
  TransitionPreset,
} from '@react-navigation/stack/lib/typescript/src/types';

const extAnimConfig: {
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

export function buildModalOpenAnimationOptions({
  isVerticalLayout,
}: {
  isVerticalLayout?: boolean;
} = {}) {
  // @react-navigation/native-stack
  if (platformEnv.isNativeAndroid) {
    return {
      animation: 'none',
      animationEnabled: false,
    };
  }

  if (platformEnv.isNativeIOSPad) {
    return {
      animation: 'slide_from_bottom',
      animationEnabled: true,
    };
  }

  if (platformEnv.isNativeIOS) {
    return {
      animation: 'slide_from_bottom',
      animationEnabled: true,
    };
  }

  // @react-navigation/stack
  if (platformEnv.isExtension) {
    return {
      animationEnabled: true,
      ...extAnimConfig.transition,
      ...extAnimConfig.openModalAnim,
    };
  }

  if (isVerticalLayout) {
    return {
      animationEnabled: true,
      ...TransitionPresets.ModalSlideFromBottomIOS,
    };
  }
  // disable default Navigation animation, use custom <PresenceTransition /> for <DesktopModal />
  //    packages/components/src/Modal/Container/Desktop.tsx
  if (platformEnv.isRuntimeBrowser) {
    return {
      animationEnabled: false,
    };
  }

  // fallback to platform defaults animation
  return {};
}

export function buildModalStackNavigatorOptions({
  isVerticalLayout,
  navInfo,
}: {
  isVerticalLayout?: boolean;
  navInfo?: {
    route: RouteProp<any>;
    navigation: any;
  };
} = {}) {
  const options: StackNavigationOptions = {
    headerShown: false,
    // not working for Android
    ...(platformEnv.isExtension
      ? { ...extAnimConfig.transition, ...extAnimConfig.stackScreenAnim }
      : { ...TransitionPresets.SlideFromRightIOS }),
  };
  if (!isNil(isVerticalLayout)) {
    options.animationEnabled = Boolean(isVerticalLayout);
  }
  if (platformEnv.isNativeAndroid) {
    // @ts-expect-error
    options.animation = 'none';
  }
  // Disable modal first screen navigation.replace() animation
  // @ts-ignore
  if (navInfo?.route?.params?._disabledAnimationOfNavigate) {
    options.animationEnabled = false;
  }
  return options;
}
