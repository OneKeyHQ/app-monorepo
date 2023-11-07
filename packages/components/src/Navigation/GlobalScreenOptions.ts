/* eslint-disable @typescript-eslint/no-unused-vars */

import { TransitionPresets } from '@react-navigation/stack';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { extAnimConfig } from './ExtAnimConfig';
import { makeHeaderScreenOptions } from './Header';

import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationOptions } from '@react-navigation/stack';
import type { VariableVal } from '@tamagui/core';

export function clearStackNavigatorOptions(options?: {
  bgColor?: string;
}): StackNavigationOptions {
  return {
    headerShown: false,
    animationEnabled: false,
  };
}

export function makeRootScreenOptions(options: {
  isVerticalLayout?: boolean;
}): StackNavigationOptions {
  return {
    headerShown: false,
    ...(options.isVerticalLayout
      ? TransitionPresets.ScaleFromCenterAndroid
      : TransitionPresets.FadeFromBottomAndroid),
  };
}

export function makeModalOpenAnimationOptions(options: {
  isVerticalLayout?: boolean;
}): StackNavigationOptions {
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
}: {
  bgColor: VariableVal;
  titleColor: VariableVal;
  isVerticalLayout?: boolean;
  navInfo?: {
    route: RouteProp<any>;
    navigation: any;
  };
}): StackNavigationOptions {
  const options: StackNavigationOptions = {
    headerShown: false,
    ...(platformEnv.isExtension
      ? { ...extAnimConfig.transition, ...extAnimConfig.stackScreenAnim }
      : undefined),
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
}): StackNavigationOptions {
  return {
    headerShown: false,
    presentation: 'transparentModal',
    cardStyle: { backgroundColor: 'transparent' },
    ...makeModalOpenAnimationOptions({ isVerticalLayout }),
  };
}

export function makeRootModalStackOptions(): StackNavigationOptions {
  return {
    headerShown: false,
    presentation: 'transparentModal',
    cardStyle: { backgroundColor: 'transparent' },
  };
}

export function makeTabScreenOptions({
  navigation,
  bgColor,
  titleColor,
}: {
  navigation: any;
  bgColor: VariableVal;
  titleColor: VariableVal;
}): StackNavigationOptions {
  // @ts-expect-error
  return {
    ...makeHeaderScreenOptions({
      isRootScreen: true,
      navigation,
      bgColor,
      titleColor,
    }),
  };
}

export function makeFullScreenOptions(): StackNavigationOptions {
  return {
    headerShown: false,
    animationEnabled: true,
    presentation: 'modal', // containedModal card fullScreenModal
    ...TransitionPresets.FadeFromBottomAndroid,
  };
}
