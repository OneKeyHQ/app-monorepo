import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import {
  StakingRoutes,
  StakingRoutesParams,
} from '@onekeyhq/kit/src/views/Staking/typing';

import StakedETHOnKele from '../../views/Staking/StakedETHOnKele';
import StakingAmount from '../../views/Staking/StakingAmount';
import StakingETHNotes from '../../views/Staking/StakingETHNotes';

import createStackNavigator from './createStackNavigator';

const StakingNavigator = createStackNavigator<StakingRoutesParams>();

const modalRoutes = [
  {
    name: StakingRoutes.StakingAmount,
    component: StakingAmount,
  },
  {
    name: StakingRoutes.StakingETHNotes,
    component: StakingETHNotes,
  },
  {
    name: StakingRoutes.StakedETHOnKele,
    component: StakedETHOnKele,
  },
];

const StakingModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <StakingNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <StakingNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </StakingNavigator.Navigator>
  );
};

export default StakingModalStack;
