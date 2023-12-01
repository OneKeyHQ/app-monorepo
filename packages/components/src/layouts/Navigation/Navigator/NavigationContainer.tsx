import { createRef } from 'react';

import { NavigationContainer as RNNavigationContainer } from '@react-navigation/native';

import type { NavigationContainerRef } from '@react-navigation/native';
import type { GetProps } from 'tamagui';

export type INavigationContainerProps = GetProps<typeof RNNavigationContainer>;
export const navigationRef = createRef<NavigationContainerRef<any>>();

export function NavigationContainer(props: INavigationContainerProps) {
  return <RNNavigationContainer {...props} ref={navigationRef} />;
}
