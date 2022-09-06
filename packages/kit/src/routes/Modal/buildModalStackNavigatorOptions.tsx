import {
  StackNavigationOptions,
  TransitionPresets,
} from '@react-navigation/stack';
import { isNil } from 'lodash';

import type { RouteProp } from '@react-navigation/core';

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
