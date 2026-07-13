/* eslint-disable @typescript-eslint/no-unused-vars */

import type { VariableVal } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType } from '../../hocs';

import { makeHeaderScreenOptions } from './Header';

import type { IScreenOptionsInfo } from './Navigator/types';
import type { IStackNavigationOptions } from './ScreenProps';
import type { RouteProp } from '@react-navigation/native';

export function clearStackNavigatorOptions(options?: {
  bgColor?: string;
}): IStackNavigationOptions {
  return {
    headerShown: false,
    animation: 'none',
  };
}

export function makeRootScreenOptions(_: {
  isVerticalLayout?: boolean;
}): IStackNavigationOptions {
  return {
    headerShown: false,
    animation: 'simple_push',
  };
}

export function makeModalOpenAnimationOptions(info: {
  isVerticalLayout?: boolean;
  optionsInfo?: IScreenOptionsInfo<any>;
}): IStackNavigationOptions {
  if (platformEnv.isNativeIOS) {
    return {
      animation: 'slide_from_bottom',
    };
  }

  if (platformEnv.isNativeAndroid) {
    // animation gets a little stuck
    return {
      animation: 'none',
    };
  }

  // fallback to platform defaults animation
  return { animation: 'none' };
}

export function makeModalStackNavigatorOptions({
  optionsInfo,
  bgColor,
  titleColor,
  pageType,
}: {
  bgColor: VariableVal;
  titleColor: VariableVal;
  isVerticalLayout?: boolean;
  optionsInfo?: IScreenOptionsInfo<any>;
  pageType?: EPageType;
}): IStackNavigationOptions {
  // Onboarding screens opt into the native (iOS 26 Liquid Glass) header; every
  // other modal (including fullScreenPush, e.g. ActionCenter) keeps the opaque
  // modal header path (isModelScreen) so its content stays below the bar.
  const isOnboardingScreen = pageType === EPageType.onboarding;
  let options: IStackNavigationOptions = {};

  if (platformEnv.isNativeAndroid) {
    options = {
      headerShown: true,
      animation: 'none',
      presentation: 'modal',
      headerShadowVisible: false,
      // Android Pad modal needs to be commented out
      ...makeHeaderScreenOptions({
        isModelScreen: !isOnboardingScreen,
        isOnboardingScreen,
        navigation: optionsInfo?.navigation,
        bgColor,
        titleColor,
      }),
    };
  }

  // Android Pad
  // if (platformEnv.isNativeAndroid && !isVerticalLayout) {
  //   options = {
  //     headerShown: true,
  //     animation: 'none',
  //     presentation: 'transparentModal',
  //     contentStyle: { backgroundColor: 'transparent' },
  //   };
  // }

  if (platformEnv.isNativeIOS) {
    options = {
      headerShown: true,
      animation: 'slide_from_right',
      ...makeHeaderScreenOptions({
        isModelScreen: !isOnboardingScreen,
        isOnboardingScreen,
        navigation: optionsInfo?.navigation,
        bgColor,
        titleColor,
      }),
      // @ts-expect-error
      contentStyle: { backgroundColor: bgColor ?? 'transparent' },
    };
  }

  // Disable modal first screen navigation.replace() animation
  if (optionsInfo?.route?.params?._disabledAnimationOfNavigate) {
    options.animation = 'none';
  }
  return options;
}

export function makeModalScreenOptions(info: {
  isVerticalLayout?: boolean;
  optionsInfo: IScreenOptionsInfo<any>;
}): IStackNavigationOptions {
  return {
    headerShown: false,
    // presentation: platformEnv.isNativeIOS ? 'modal' : 'transparentModal',
    presentation: 'modal',
    ...makeModalOpenAnimationOptions(info),
  };
}

export function makeRootModalStackOptions(params?: {
  bgColor?: string;
}): IStackNavigationOptions {
  const options: IStackNavigationOptions = {
    headerShown: false,
  };

  if (platformEnv.isNativeAndroid) {
    // animation gets a little stuck
    options.animation = 'none';
  }

  if (params?.bgColor) {
    options.contentStyle = { backgroundColor: params.bgColor };
  }

  return options;
}

export function makeTabScreenOptions({
  navigation,
  bgColor,
  titleColor,
}: {
  navigation: any;
  bgColor: VariableVal;
  titleColor: VariableVal;
}): IStackNavigationOptions {
  const options: IStackNavigationOptions = {
    headerShown: true,
    ...makeHeaderScreenOptions({
      isRootScreen: true,
      navigation,
      bgColor,
      titleColor,
    }),
  };

  if (platformEnv.isNativeAndroid) {
    // animation gets a little stuck
    options.animation = 'none';
  }

  return options;
}

export function makeFullScreenOptions(): IStackNavigationOptions {
  return {
    headerShown: false,
    presentation: 'card',
    gestureEnabled: true,
    gestureDirection: 'vertical',
    ...makeModalOpenAnimationOptions({ isVerticalLayout: true }),
  };
}

export function makeOnboardingScreenOptions(): IStackNavigationOptions {
  const options: IStackNavigationOptions = {
    headerShown: false,
    presentation: 'card',
    gestureEnabled: platformEnv.isNativeIOS,
    gestureDirection: 'horizontal',
    animation: 'slide_from_right',
  };
  if (platformEnv.isNativeAndroid) {
    options.animation = 'none';
  }
  return options;
}

// Independent factory so WebView's screen options can diverge from Onboarding's
// without coupling the two. Today the shape mirrors makeOnboardingScreenOptions;
// keep them separate so future tweaks (e.g. a different gesture config) only
// affect this surface.
export function makeWebviewScreenOptions(): IStackNavigationOptions {
  const options: IStackNavigationOptions = {
    headerShown: false,
    presentation: 'card',
    gestureEnabled: platformEnv.isNativeIOS,
    gestureDirection: 'horizontal',
    animation: 'slide_from_right',
  };
  if (platformEnv.isNativeAndroid) {
    options.animation = 'none';
  }
  return options;
}
