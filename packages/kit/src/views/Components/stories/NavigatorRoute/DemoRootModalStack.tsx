import { useMemo } from 'react';

import {
  createStackNavigator,
  makeRootModalStackOptions,
} from '@onekeyhq/components/src/Navigation';

import DemoCreateModalStack from './Modal/DemoCreateModal';
import DemoDoneModalStack from './Modal/DemoDoneModal';
import { DemoModalRoutes } from './Modal/types';

import type { DemoModalRoutesParams } from './types';

const modalStackScreenList = [
  {
    name: DemoModalRoutes.DemoCreateModal,
    component: DemoCreateModalStack,
  },
  {
    name: DemoModalRoutes.DemoDoneModal,
    component: DemoDoneModalStack,
  },
];

const DemoRootModalStack = createStackNavigator<DemoModalRoutesParams>();

const DemoModalStackNavigator = () => {
  const screenOptions = useMemo(() => makeRootModalStackOptions(), []);
  return (
    <DemoRootModalStack.Navigator screenOptions={screenOptions}>
      {modalStackScreenList.map((modal) => (
        <DemoRootModalStack.Screen
          key={modal.name}
          name={modal.name}
          component={modal.component}
        />
      ))}
    </DemoRootModalStack.Navigator>
  );
};

export default DemoModalStackNavigator;
