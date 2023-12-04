import { memo } from 'react';

import { NavigationContainer as NavigationContainerComponent } from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

const formatter = () => 'OneKey';
const documentTitle = {
  formatter,
};

function BasicNavigationApp() {
  return (
    <NavigationContainerComponent documentTitle={documentTitle}>
      <RootNavigator />
    </NavigationContainerComponent>
  );
}

export const NavigationContainer = memo(BasicNavigationApp);
