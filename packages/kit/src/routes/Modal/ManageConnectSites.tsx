import { useIsVerticalLayout } from '@onekeyhq/components';
import ConnectedSites from '@onekeyhq/kit/src/views/ManageConnectedSites/ConnectedSites';
import type { ManageConnectedSitesRoutesParams } from '@onekeyhq/kit/src/views/ManageConnectedSites/types';
import { ManageConnectedSitesRoutes } from '@onekeyhq/kit/src/views/ManageConnectedSites/types';

import createStackNavigator from './createStackNavigator';

const ManageConnectedSitesNavigator =
  createStackNavigator<ManageConnectedSitesRoutesParams>();
const modelRoutes = [
  {
    name: ManageConnectedSitesRoutes.ManageConnectedSitesModel,
    component: ConnectedSites,
  },
];

const ManageConnectedSitesModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManageConnectedSitesNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modelRoutes.map((route) => (
        <ManageConnectedSitesNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManageConnectedSitesNavigator.Navigator>
  );
};
export default ManageConnectedSitesModalStack;
