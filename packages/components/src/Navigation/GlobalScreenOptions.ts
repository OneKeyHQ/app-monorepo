/* eslint-disable @typescript-eslint/no-unused-vars */

import { TransitionPresets } from '@react-navigation/stack';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { extAnimConfig } from './ExtAnimConfig';
import { makeHeaderScreenOptions } from './Header';

import type { StackNavigationOptions } from './StackNavigator';
import type { RouteProp } from '@react-navigation/native';

export function clearStackNavigatorOptions(options?: {
  bgColor?: string;
}): StackNavigationOptions {
  return {
    headerShown: false,
    cardStyle: { backgroundColor: 'transparent' },
    animationEnabled: false,
  };
}

export function makeRootScreenOptions(options: { isVerticalLayout?: boolean }) {
  return {
    headerShown: false,
    ...(options.isVerticalLayout
      ? TransitionPresets.ScaleFromCenterAndroid
      : TransitionPresets.FadeFromBottomAndroid),
  };
}

export function makeModalOpenAnimationOptions(options: {
  isVerticalLayout?: boolean;
}) {
  if (platformEnv.isExtension) {
    return {
      animationEnabled: true,
      ...extAnimConfig.transition,
      ...extAnimConfig.openModalAnim,
    };
  }

  if (options.isVerticalLayout) {
    return {
      animationEnabled: true,
      ...TransitionPresets.ModalSlideFromBottomIOS,
    };
  }

  // fallback to platform defaults animation
  return { animationEnabled: false };
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
  // @ts-expect-error
  const options: StackNavigationOptions = {
    headerShown: false,
    ...(platformEnv.isExtension
      ? { ...extAnimConfig.transition, ...extAnimConfig.stackScreenAnim }
      : undefined),
    ...makeHeaderScreenOptions({
      isModelScreen: true,
      navigation: navInfo?.navigation,
    }),
  };

  // Disable modal first screen navigation.replace() animation
  if (navInfo?.route?.params?._disabledAnimationOfNavigate) {
    options.animationEnabled = false;
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
    presentation: 'transparentModal',
    cardStyle: { backgroundColor: 'transparent' },
    ...makeModalOpenAnimationOptions({ isVerticalLayout }),
  };
}

export function makeRootModalStackOptions() {
  return {
    headerShown: false,
    presentation: 'transparentModal',
    cardStyle: { backgroundColor: 'transparent' },
  };
}

export function makeFullScreenOptions() {
  return {
    headerShown: false,
    animationEnabled: true,
    presentation: 'modal', // containedModal card fullScreenModal
    ...TransitionPresets.FadeFromBottomAndroid,
  };
}
