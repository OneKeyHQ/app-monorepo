import { useIsVerticalLayout } from '@onekeyhq/components';

import ClearCacheModal from '../../../views/ClearCache/ClearCacheModal';
import CopyBrowserUrlModal from '../../../views/ClearCache/CopyBrowserUrlModal';
import { ClearCacheModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

export type ClearCacheModalRoutesParams = {
  [ClearCacheModalRoutes.ClearCacheModal]: undefined;
  [ClearCacheModalRoutes.CopyBrowserUrlModal]: undefined;
};

const ClearCacheNavigator = createStackNavigator<ClearCacheModalRoutesParams>();

const modalRoutes = [
  {
    name: ClearCacheModalRoutes.ClearCacheModal,
    component: ClearCacheModal,
  },
  {
    name: ClearCacheModalRoutes.CopyBrowserUrlModal,
    component: CopyBrowserUrlModal,
  },
];

const ClearCacheModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ClearCacheNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ClearCacheNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ClearCacheNavigator.Navigator>
  );
};

export default ClearCacheModalStack;
