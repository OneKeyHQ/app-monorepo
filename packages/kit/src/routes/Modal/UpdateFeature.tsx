import { useIsVerticalLayout } from '@onekeyhq/components';
import type { VersionInfo } from '@onekeyhq/kit/src/utils/updates/type';
import UpdateFeature from '@onekeyhq/kit/src/views/Update/Feature';
import ForcedUpdate from '@onekeyhq/kit/src/views/Update/ForcedUpdate';

import createStackNavigator from './createStackNavigator';

export enum UpdateFeatureModalRoutes {
  UpdateFeatureModal = 'UpdateFeatureModal',
  ForcedUpdateModal = 'ForcedUpdateModal',
}

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
