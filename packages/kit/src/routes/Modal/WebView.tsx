import { useIsVerticalLayout } from '@onekeyhq/components';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import Webview from '@onekeyhq/kit/src/views/Webview';

import { CreateAccountModalRoutes } from '../routesEnum';

import { buildModalOpenAnimationOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export { CreateAccountModalRoutes };

export enum WebviewRoutesModalRoutes {
  WebviewModel = 'WebviewModel',
}

export type WebviewRoutesParams = {
  [WebviewRoutesModalRoutes.WebviewModel]: HomeRoutesParams['SettingsWebviewScreen'];
};

const WebViewNavigator = createStackNavigator<WebviewRoutesParams>();

const modalRoutes = [
  {
    name: WebviewRoutesModalRoutes.WebviewModel,
    component: Webview,
  },
];

const WebviewModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <WebViewNavigator.Navigator
      screenOptions={() => ({
        ...buildModalOpenAnimationOptions({ isVerticalLayout }),
        headerShown: true,
      })}
    >
      {modalRoutes.map((route) => (
        <WebViewNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </WebViewNavigator.Navigator>
  );
};

export default WebviewModalStack;
