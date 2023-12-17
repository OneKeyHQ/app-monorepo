import { createRef, useRef } from 'react';

import { NavigationContainer as RNNavigationContainer } from '@react-navigation/native';

import { trackPage } from '@onekeyhq/shared/src/modules3rdParty/mixpanel';

import type { useNavigationContainerRef } from '@react-navigation/native';
import type { GetProps } from 'tamagui';

type IBasicNavigationContainerProps = GetProps<typeof RNNavigationContainer>;
export type INavigationContainerProps = Partial<IBasicNavigationContainerProps>;
export const navigationRef =
  createRef<ReturnType<typeof useNavigationContainerRef>>();

export function NavigationContainer(props: IBasicNavigationContainerProps) {
  const routeNameRef = useRef('');
  return (
    <RNNavigationContainer
      {...props}
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current =
          navigationRef.current?.getCurrentRoute()?.name || '';
      }}
      onStateChange={async () => {
        const previousRouteName = routeNameRef.current;
        const currentRouteName =
          navigationRef.current?.getCurrentRoute()?.name || '';

        if (previousRouteName !== currentRouteName) {
          // Save the current route name for later comparison
          routeNameRef.current = currentRouteName;

          // Replace the line below to add the tracker from a mobile analytics SDK
          trackPage(currentRouteName);
        }
      }}
    />
  );
}
