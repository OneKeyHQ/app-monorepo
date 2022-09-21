import {
  StackNavigationOptions,
  TransitionPresets,
} from '@react-navigation/stack';
import { isNil } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { RouteProp } from '@react-navigation/core';

export function buildModalOpenAnimationOptions({
  isVerticalLayout,
}: {
  isVerticalLayout?: boolean;
} = {}) {
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
  if (platformEnv.isNativeIOSPad) {
    return {
      animationEnabled: true,
      ...TransitionPresets.ModalSlideFromBottomIOS,
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
    ...TransitionPresets.SlideFromRightIOS,
  };
  if (!isNil(isVerticalLayout)) {
    options.animationEnabled = Boolean(isVerticalLayout);
  }
  // Disable modal first screen navigation.replace() animation
  // @ts-ignore
  if (navInfo?.route?.params?._disabledAnimationOfNavigate) {
    options.animationEnabled = false;
  }
  return options;
}
