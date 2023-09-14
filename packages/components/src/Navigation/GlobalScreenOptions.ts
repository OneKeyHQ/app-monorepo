import { TransitionPresets } from '@react-navigation/stack';
import { isNil } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { extAnimConfig } from './ExtAnimConfig';

import type { RouteProp } from '@react-navigation/core';
import type { StackNavigationOptions } from '@react-navigation/stack';

export function makeRootScreenOptions({
  isVerticalLayout,
}: {
  isVerticalLayout?: boolean;
}) {
  return {
    headerShown: false,
    ...(isVerticalLayout
      ? TransitionPresets.ScaleFromCenterAndroid
      : TransitionPresets.FadeFromBottomAndroid),
  };
}

export function makeOnboardingScreenOptions() {
  return {
    presentation: 'modal', // containedModal card fullScreenModal
    ...TransitionPresets.FadeFromBottomAndroid,
  };
}

export function makeModalOpenAnimationOptions({
  isVerticalLayout,
}: {
  isVerticalLayout?: boolean;
} = {}) {
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
  const options: StackNavigationOptions = {
    headerShown: false,
    ...(platformEnv.isExtension
      ? { ...extAnimConfig.transition, ...extAnimConfig.stackScreenAnim }
      : { ...TransitionPresets.SlideFromRightIOS }),
  };

  if (!isNil(isVerticalLayout)) {
    // Landscape screen web animation is weird
    options.animationEnabled = Boolean(isVerticalLayout);
  }

  // Disable modal first screen navigation.replace() animation
  if (navInfo?.route?.params?._disabledAnimationOfNavigate) {
    options.animationEnabled = false;
  }
  return options;
}

export function makeModalScreenOptions(isVerticalLayout: boolean) {
  return {
    headerShown: false,
    presentation: 'transparentModal',
    ...makeModalOpenAnimationOptions({ isVerticalLayout }),
  };
}
