import { createRef, memo } from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { useThemeValue } from '@onekeyhq/components';
import { DevScreen } from '@onekeyhq/kit/src/routes';

export const navigationRef = createRef();
global.$navigationRef = navigationRef as any;

const NavigationApp = () => {
  const background = useThemeValue('bg') as string;
  console.log(background);
  return (
    <NavigationContainer
      theme={{
        colors: {
          background,
        },
      }}
      documentTitle={{
        formatter: () => 'OneKey',
      }}
      ref={navigationRef}
    >
      <DevScreen />
    </NavigationContainer>
  );
};

NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
