import { useIsVerticalLayout } from '@onekeyhq/components';

import ETHPoolSelector from '../../../views/Staking/ETHPoolSelector';
import ETHStake from '../../../views/Staking/ETHStake';
import Feedback from '../../../views/Staking/Feedback';
import KeleEthStakeShouldUnderstand from '../../../views/Staking/KeleEthStakeShouldUnderstand';
import KeleEthUnstakeShouldUnderstand from '../../../views/Staking/KeleEthUnstakeShouldUnderstand';
import LidoEthStakeShouldUnderStand from '../../../views/Staking/LidoEthStakeShouldUnderstand';
import LidoEthUnstake from '../../../views/Staking/LidoEthUnstake';
import LidoEthUnstakeRoutes from '../../../views/Staking/LidoEthUnstakeRoutes';
import LidoEthUnstakeShouldUnderstand from '../../../views/Staking/LidoEthUnstakeShouldUnderstand';
import StakedETHOnKele from '../../../views/Staking/StakedETHOnKele';
import StakedETHOnLido from '../../../views/Staking/StakedETHOnLido';
import StakingAmount from '../../../views/Staking/StakingAmount';
import { StakingRoutes } from '../../../views/Staking/typing';
import UnstakeAmount from '../../../views/Staking/UnstakeAmount';
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
    name: StakingRoutes.KeleEthStakeShouldUnderstand,
    component: KeleEthStakeShouldUnderstand,
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
    name: StakingRoutes.KeleEthUnstakeShouldUnderstand,
    component: KeleEthUnstakeShouldUnderstand,
  },
  {
    name: StakingRoutes.WithdrawAmount,
    component: WithdrawAmount,
  },
  {
    name: StakingRoutes.Feedback,
    component: Feedback,
  },
  {
    name: StakingRoutes.ETHPoolSelector,
    component: ETHPoolSelector,
  },
  {
    name: StakingRoutes.LidoEthStakeShouldUnderstand,
    component: LidoEthStakeShouldUnderStand,
  },
  {
    name: StakingRoutes.LidoEthUnstakeShouldUnderstand,
    component: LidoEthUnstakeShouldUnderstand,
  },
  {
    name: StakingRoutes.ETHStake,
    component: ETHStake,
  },
  {
    name: StakingRoutes.StakedETHOnLido,
    component: StakedETHOnLido,
  },
  {
    name: StakingRoutes.LidoEthUnstake,
    component: LidoEthUnstake,
  },
  {
    name: StakingRoutes.LidoEthUnstakeRoutes,
    component: LidoEthUnstakeRoutes,
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
