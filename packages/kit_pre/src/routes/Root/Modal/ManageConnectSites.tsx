import { useIsVerticalLayout } from '@onekeyhq/components';

import ConnectedSites from '../../../views/ManageConnectedSites/ConnectedSites';
import { ManageConnectedSitesRoutes } from '../../../views/ManageConnectedSites/types';

import createStackNavigator from './createStackNavigator';

import type { ManageConnectedSitesRoutesParams } from '../../../views/ManageConnectedSites/types';

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
