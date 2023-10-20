import { createRef, memo, useEffect } from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { useTheme } from 'tamagui';

import { setBackgroundColor } from '@onekeyhq/components/src/Navigation/utils/StatusBarUtils';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

export const navigationRef = createRef();
global.$navigationRef = navigationRef as any;

const NavigationApp = () => {
  const theme = useTheme();

  useEffect(() => {
    setBackgroundColor(theme.bg.val);
  }, [theme]);

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
      <RootNavigator />
    </NavigationContainer>
  );
};
NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
