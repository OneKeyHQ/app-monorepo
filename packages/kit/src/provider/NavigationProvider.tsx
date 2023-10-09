import { createRef, memo } from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { useTheme } from 'tamagui';

import { useThemeValue } from '@onekeyhq/components';
import { DevScreen } from '@onekeyhq/kit/src/routes';

import { DemoRootApp } from '../views/Components/stories/NavigatorRoute/DemoRootApp';

export const navigationRef = createRef();
global.$navigationRef = navigationRef as any;

const NavigationApp = () => {
  const theme = useTheme();

  return (
    <NavigationContainer
      theme={{
        colors: {
          background: theme.bg.val,
        },
      }}
      documentTitle={{
        formatter: () => 'OneKey',
      }}
      ref={navigationRef}
    >
      <DevScreen />
      {/* <DemoRootApp /> */}
    </NavigationContainer>
  );
};
NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
