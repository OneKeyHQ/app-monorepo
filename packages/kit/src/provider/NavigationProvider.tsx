import { createRef, memo, useMemo } from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { DevScreen } from '@onekeyhq/kit/src/routes';

export const navigationRef = createRef();
global.$navigationRef = navigationRef as any;

const NavigationApp = () => (
  <NavigationContainer
    documentTitle={{
      formatter: () => 'OneKey',
    }}
    ref={navigationRef}
  >
    <DevScreen />
  </NavigationContainer>
);

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
