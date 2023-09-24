/* eslint-disable @typescript-eslint/no-unused-vars */

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { makeHeaderScreenOptions } from './Header';

import type { StackNavigationOptions } from './StackNavigator.native';
import type { RouteProp } from '@react-navigation/native';

export function clearStackNavigatorOptions(options?: {
  bgColor?: string;
}): StackNavigationOptions {
  return {
    headerShown: false,
    contentStyle: {
      backgroundColor: 'transparent',
    },
    animation: 'none',
  };
}

export function makeRootScreenOptions(_: { isVerticalLayout?: boolean }) {
  return {
    headerShown: false,
    animation: 'simple_push',
  };
}

export function makeModalOpenAnimationOptions(_: {
  isVerticalLayout?: boolean;
}) {
  if (platformEnv.isNativeIOS) {
    return {
      animation: 'slide_from_bottom',
    };
  }

  if (platformEnv.isNativeAndroid) {
    // animation gets a little stuck
    return {
      animation: 'fade',
    };
  }

  // fallback to platform defaults animation
  return { animation: 'none' };
}

export function makeModalStackNavigatorOptions({
  navInfo,
  isVerticalLayout,
}: {
  isVerticalLayout?: boolean;
  navInfo?: {
    route: RouteProp<any>;
    navigation: any;
  };
} = {}) {
  let options: StackNavigationOptions = {};

  if (platformEnv.isNativeAndroid) {
    options = {
      headerShown: true,
      animation: 'none',
      presentation: 'modal',
      headerShadowVisible: false,
    };
  }

  // Android Pad
  if (platformEnv.isNativeAndroid && !isVerticalLayout) {
    options = {
      headerShown: false,
      animation: 'none',
      presentation: 'transparentModal',
      contentStyle: { backgroundColor: 'transparent' },
    };
  }

  if (platformEnv.isNativeIOS) {
    options = {
      headerShown: true,
      animation: 'slide_from_right',
      ...makeHeaderScreenOptions({
        isModelScreen: true,
        navigation: navInfo?.navigation,
      }),
    };
  }

  // Disable modal first screen navigation.replace() animation
  if (navInfo?.route?.params?._disabledAnimationOfNavigate) {
    options.animation = 'none';
  }
  return options;
}

export function makeModalScreenOptions({
  isVerticalLayout,
}: {
  isVerticalLayout: boolean;
}) {
  return {
    headerShown: false,
    presentation: platformEnv.isNativeIOS ? 'modal' : 'transparentModal',
    ...makeModalOpenAnimationOptions({ isVerticalLayout }),
  };
}

export function makeRootModalStackOptions() {
  return {
    headerShown: false,
  };
}

export function makeFullScreenOptions() {
  return {
    headerShown: false,
    presentation: 'fullScreenModal', // containedModal card fullScreenModal
    animation: 'fade',
  };
}
