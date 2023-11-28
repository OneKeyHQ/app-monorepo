import { createRef } from 'react';

import { NavigationContainer as RNNavigationContainer } from '@react-navigation/native';

import type { NavigationContainerRef } from '@react-navigation/native';
import type { GetProps } from 'tamagui';

export const navigationRef = createRef<NavigationContainerRef<any>>();

export function NavigationContainer(
  props: GetProps<typeof RNNavigationContainer>,
) {
  return <RNNavigationContainer {...props} ref={navigationRef} />;
}
