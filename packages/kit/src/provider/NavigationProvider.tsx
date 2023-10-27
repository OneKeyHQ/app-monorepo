import { createRef, memo } from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { RootNavigator } from '@onekeyhq/kit/src/routes';

export const navigationRef = createRef();
global.$navigationRef = navigationRef as any;

const NavigationApp = () => (
  <NavigationContainer
    documentTitle={{
      formatter: () => 'OneKey',
    }}
    ref={navigationRef}
  >
    <RootNavigator />
  </NavigationContainer>
);
NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
