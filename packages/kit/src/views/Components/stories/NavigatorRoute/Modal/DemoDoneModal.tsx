import { Stack } from '@onekeyhq/components';
import {
  createStackNavigator,
  makeModalStackNavigatorOptions,
} from '@onekeyhq/components/src/Navigation';
import useIsVerticalLayout from '@onekeyhq/components/src/Provider/hooks/useIsVerticalLayout';

import { DemoCreateModalRoutes } from '../Routes';

import type { ModalRoutesType } from '../../../../../routes/Root/Modal/types';
import type { DemoDoneModalRoutes } from '../Routes';

export type DemoDoneModalRoutesParams = {
  [DemoDoneModalRoutes.DemoDoneModal]: undefined;
  [DemoDoneModalRoutes.DemoDone1Modal]: undefined;
};

const DemoDoneModalNavigator =
  createStackNavigator<DemoDoneModalRoutesParams>();

const DemoDoneViewModal = () => {
  console.log('DemoCreateViewModal');

  return <Stack />;
};

const DemoDone1ViewModal = () => {
  console.log('DemoCreateViewModal');

  return <Stack />;
};

const modalRoutes: ModalRoutesType<DemoCreateModalRoutes> = [
  {
    name: DemoCreateModalRoutes.DemoCreateModal,
    component: DemoDoneViewModal,
  },
  {
    name: DemoCreateModalRoutes.DemoCreateSearchModal,
    component: DemoDone1ViewModal,
  },
];

const DemoDoneModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DemoDoneModalNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...makeModalStackNavigatorOptions({ navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <DemoDoneModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DemoDoneModalNavigator.Navigator>
  );
};
export default DemoDoneModalStack;
