import { useIsVerticalLayout } from '@onekeyhq/components';

import UpdateFeature from '../../../views/Update/Feature';
import ForcedUpdate from '../../../views/Update/ForcedUpdate';
import { UpdateFeatureModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

import type { VersionInfo } from '../../../utils/updates/type';

export type UpdateFeatureRoutesParams = {
  [UpdateFeatureModalRoutes.UpdateFeatureModal]: {
    changeLog: string | undefined;
    newVersion: string;
  };
  [UpdateFeatureModalRoutes.ForcedUpdateModal]: {
    versionInfo: VersionInfo;
  };
};

const UpdateFeatureNavigator =
  createStackNavigator<UpdateFeatureRoutesParams>();

const modalRoutes = [
  {
    name: UpdateFeatureModalRoutes.UpdateFeatureModal,
    component: UpdateFeature,
  },
  {
    name: UpdateFeatureModalRoutes.ForcedUpdateModal,
    component: ForcedUpdate,
  },
];

const UpdateFeatureModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <UpdateFeatureNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <UpdateFeatureNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </UpdateFeatureNavigator.Navigator>
  );
};

export default UpdateFeatureModalStack;
