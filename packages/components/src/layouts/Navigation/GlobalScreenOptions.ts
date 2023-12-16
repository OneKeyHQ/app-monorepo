/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  // eslint-disable-next-line spellcheck/spell-checker
  CardStyleInterpolators,
  TransitionPresets,
} from '@react-navigation/stack';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { extAnimConfig } from './ExtAnimConfig';
import { makeHeaderScreenOptions } from './Header';

import type { IScreenOptionsInfo } from './Navigator/types';
import type { RouteProp } from '@react-navigation/native';
import type { ParamListBase } from '@react-navigation/routers';
import type { StackNavigationOptions } from '@react-navigation/stack';
import type { VariableVal } from '@tamagui/core';

export function clearStackNavigatorOptions(options?: {
  bgColor?: string;
}): StackNavigationOptions {
  return {
    /*

      We have configured all `detachPreviousScreen` options as false to address the flash screen issue when popping. 
      This is because it also hides `cardStyle.backgroundColor`, leaving only the unconfigurable gray-white background color of the `Background`.
      See https://github.com/react-navigation/react-navigation/blob/858a8746a5c007a623206c920f70d55935ed39b4/packages/stack/src/views/Stack/CardStack.tsx#L595C1-L676 

      Even if we address the background color issue, re-rendering will still cause some flickering. Therefore, using `freezeOnBlur` alone is sufficient.

    */
    detachPreviousScreen: false,
    headerShown: false,
    animationEnabled: false,
  };
}

export function makeRootScreenOptions(options: {
  isVerticalLayout?: boolean;
}): StackNavigationOptions {
  return {
    detachPreviousScreen: false,
    headerShown: false,
    ...(options.isVerticalLayout
      ? TransitionPresets.ScaleFromCenterAndroid
      : TransitionPresets.FadeFromBottomAndroid),
  };
}

export function makeModalOpenAnimationOptions(info: {
  isVerticalLayout?: boolean;
  optionsInfo: IScreenOptionsInfo<any>;
}): StackNavigationOptions {
  if (platformEnv.isExtension) {
    return {
      animationEnabled: true,
      ...extAnimConfig.transition,
      ...extAnimConfig.openModalAnim,
    };
  }

  if (info.isVerticalLayout) {
    return {
      animationEnabled: true,
      ...TransitionPresets.ModalPresentationIOS,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const currentRouteIndex = info?.optionsInfo?.navigation
    ?.getState?.()
    ?.routes?.findIndex?.(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (route: any) => route?.key === info?.optionsInfo?.route?.key,
    );

  return {
    animationEnabled: true,
    ...(currentRouteIndex > 1
      ? TransitionPresets.BottomSheetAndroid
      : TransitionPresets.ModalPresentationIOS),
  };
}

export function makeModalStackNavigatorOptions({
  optionsInfo,
  bgColor,
  titleColor,
}: {
  bgColor: VariableVal;
  titleColor: VariableVal;
  isVerticalLayout?: boolean;
  optionsInfo?: IScreenOptionsInfo<any>;
}): StackNavigationOptions {
  const options: StackNavigationOptions = {
    detachPreviousScreen: false,
    headerShown: platformEnv.isRuntimeBrowser,
    animationEnabled: true,
    // eslint-disable-next-line spellcheck/spell-checker
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    ...(platformEnv.isExtension
      ? { ...extAnimConfig.transition, ...extAnimConfig.stackScreenAnim }
      : undefined),
  };

  // Disable modal first screen navigation.replace() animation
  if (optionsInfo?.route?.params?._disabledAnimationOfNavigate) {
    options.animationEnabled = false;
  }
  return options;
}

export function makeModalScreenOptions(info: {
  isVerticalLayout?: boolean;
  optionsInfo: IScreenOptionsInfo<any>;
}): StackNavigationOptions {
  return {
    detachPreviousScreen: false,
    headerShown: false,
    presentation: 'transparentModal',
    cardStyle: { backgroundColor: 'transparent' },
    ...makeModalOpenAnimationOptions(info),
  };
}

export function makeRootModalStackOptions(): StackNavigationOptions {
  return {
    detachPreviousScreen: false,
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
    detachPreviousScreen: false,
    // fix the height of the right content on web when the left side bar is closed
    cardStyle: { flex: 1 },
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
    detachPreviousScreen: false,
    headerShown: false,
    animationEnabled: true,
    presentation: 'modal', // containedModal card fullScreenModal
    ...TransitionPresets.FadeFromBottomAndroid,
  };
}
