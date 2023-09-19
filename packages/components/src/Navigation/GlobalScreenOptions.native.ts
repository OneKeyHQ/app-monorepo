/* eslint-disable @typescript-eslint/no-unused-vars */

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { makeHeaderScreenOptions } from './Header';

import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export function makeRootScreenOptions(_: { isVerticalLayout?: boolean }) {
  return {
    headerShown: false,
    animation: 'simple_push',
  };
}

export function makeOnboardingScreenOptions() {
  return {
    presentation: 'fullScreenModal', // containedModal card fullScreenModal
    animation: 'fade',
  };
}

export function makeModalOpenAnimationOptions(_: {
  isVerticalLayout?: boolean;
}) {
  if (platformEnv.isNativeIOS) {
    return {
      animationEnabled: true,
      animation: 'slide_from_bottom',
    };
  }

  if (platformEnv.isNativeAndroid) {
    // animation gets a little stuck
    return {
      animationEnabled: true,
      animation: 'fade',
    };
  }

  // fallback to platform defaults animation
  return {};
}

export function makeModalStackNavigatorOptions({
  navInfo,
}: {
  navInfo?: {
    route: RouteProp<any>;
    navigation: any;
  };
} = {}) {
  const options: NativeStackNavigationOptions = {
    headerShown: true,
    animation: 'slide_from_right',
    ...makeHeaderScreenOptions({
      isModelScreen: true,
      navigation: navInfo?.navigation,
    }),
  };

  if (platformEnv.isNativeAndroid) {
    // Animation page stuck
    options.animation = 'none';
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
    presentation: 'modal',
    ...makeModalOpenAnimationOptions({ isVerticalLayout }),
  };
}

export function makeRootModalStackOptions() {
  return {
    headerShown: false,
  };
}
