import { useIsVerticalLayout } from '@onekeyhq/components';
import UpdateFeature from '@onekeyhq/kit/src/views/Update/Feature';

import createStackNavigator from './createStackNavigator';

export enum UpdateFeatureModalRoutes {
  UpdateFeatureModal = 'UpdateFeatureModal',
}

export type UpdateFeatureRoutesParams = {
  [UpdateFeatureModalRoutes.UpdateFeatureModal]: {
    changeLog: string | undefined;
    newVersion: string;
  };
};

const UpdateFeatureNavigator =
  createStackNavigator<UpdateFeatureRoutesParams>();

const modalRoutes = [
  {
    name: UpdateFeatureModalRoutes.UpdateFeatureModal,
    component: UpdateFeature,
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
