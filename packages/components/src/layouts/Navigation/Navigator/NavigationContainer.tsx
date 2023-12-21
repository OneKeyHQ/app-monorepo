import { createRef } from 'react';

import { NavigationContainer as RNNavigationContainer } from '@react-navigation/native';

import type { NavigationContainerRef } from '@react-navigation/native';
import type { GetProps } from 'tamagui';

type IBasicNavigationContainerProps = GetProps<typeof RNNavigationContainer>;
export type INavigationContainerProps = Partial<IBasicNavigationContainerProps>;
export const rootNavigationRef = createRef<NavigationContainerRef<any>>();

export function NavigationContainer(props: IBasicNavigationContainerProps) {
  return <RNNavigationContainer {...props} ref={rootNavigationRef} />;
}
