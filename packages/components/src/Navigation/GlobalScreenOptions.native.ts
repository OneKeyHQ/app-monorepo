/* eslint-disable @typescript-eslint/no-unused-vars */

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  isVerticalLayout,
  navInfo,
}: {
  isVerticalLayout?: boolean;
  navInfo?: {
    route: RouteProp<any>;
    navigation: any;
  };
} = {}) {
  const options: NativeStackNavigationOptions = {
    headerShown: false,
    animation: 'slide_from_right',
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

export function makeModalScreenOptions(isVerticalLayout: boolean) {
  return {
    headerShown: false,
    presentation: 'modal',
    ...makeModalOpenAnimationOptions({ isVerticalLayout }),
  };
}
