import { createRef, memo } from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { RootNavigator } from '@onekeyhq/kit/src/routes';

export const navigationRef = createRef();
// @ts-ignore
global.$navigationRef = navigationRef as any;

const NavigationApp = () => (
  <NavigationContainer
    documentTitle={{
      formatter: () => 'OneKey',
    }}
    // @ts-ignore
    ref={navigationRef}
  >
    <RootNavigator />
  </NavigationContainer>
);
NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
