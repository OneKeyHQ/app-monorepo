import { useIsVerticalLayout } from '@onekeyhq/components';
import type { HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';
import Webview from '@onekeyhq/kit/src/views/Webview';

import { buildModalOpenAnimationOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export enum WebviewRoutesModalRoutes {
  WebviewModal = 'WebviewModal',
}

export type WebviewRoutesParams = {
  [WebviewRoutesModalRoutes.WebviewModal]: HomeRoutesParams['SettingsWebviewScreen'];
};

const WebViewNavigator = createStackNavigator<WebviewRoutesParams>();

const modalRoutes = [
  {
    name: WebviewRoutesModalRoutes.WebviewModal,
    component: Webview,
  },
];

const WebviewModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <WebViewNavigator.Navigator
      screenOptions={() => ({
        ...buildModalOpenAnimationOptions({ isVerticalLayout }),
        headerShown: false,
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
