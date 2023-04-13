import { useIsVerticalLayout } from '@onekeyhq/components';

import StakedETHOnKele from '../../../views/Staking/StakedETHOnKele';
import StakingAmount from '../../../views/Staking/StakingAmount';
import StakingETHNotes from '../../../views/Staking/StakingETHNotes';
import { StakingRoutes } from '../../../views/Staking/typing';
import UnstakeAmount from '../../../views/Staking/UnstakeAmount';
import UnstakeKeleETHNotes from '../../../views/Staking/UnstakeKeleETHNotes';
import WithdrawAmount from '../../../views/Staking/WithdrawAmount';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { StakingRoutesParams } from '../../../views/Staking/typing';

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
  {
    name: StakingRoutes.UnstakeAmount,
    component: UnstakeAmount,
  },
  {
    name: StakingRoutes.UnstakeKeleETHNotes,
    component: UnstakeKeleETHNotes,
  },
  {
    name: StakingRoutes.WithdrawAmount,
    component: WithdrawAmount,
  },
];

const StakingModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <StakingNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
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
